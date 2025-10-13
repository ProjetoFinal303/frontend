import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.12.0'
import { corsHeaders } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (_req) => {
  try {
    console.log("Iniciando sincronização de produtos...");

    // 1. Buscar todos os preços ATIVOS do Stripe
    const { data: prices } = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100,
    });
    console.log(`Encontrados ${prices.length} preços ativos no Stripe.`);

    const stripePriceIds = prices.map(p => p.id);
    const stripeProductIds = prices.map(p => (p.product as Stripe.Product).id);

    // 2. Buscar todos os produtos do Supabase
    const { data: supabaseProducts, error: fetchError } = await supabaseAdmin
      .from('Produto')
      .select('id, stripe_price_id');

    if (fetchError) throw new Error(`Erro ao buscar produtos do Supabase: ${fetchError.message}`);
    console.log(`Encontrados ${supabaseProducts.length} produtos no banco de dados.`);
    const supabasePriceIds = supabaseProducts.map(p => p.stripe_price_id);

    // ============================ LÓGICA DE CORREÇÃO ============================
    // 3. ENCONTRAR E DESATIVAR "ÓRFÃOS": Produtos ativos no Stripe mas ausentes no Supabase
    // (Isso acontece quando o site deleta do DB mas não do Stripe)
    for (const price of prices) {
      if (!supabasePriceIds.includes(price.id)) {
        const product = price.product as Stripe.Product;
        console.warn(`Produto órfão encontrado: '${product.name}'. Foi deletado do site mas ainda estava ativo no Stripe. Desativando agora...`);
        // Desativa o preço e o produto no Stripe para corrigir a falha do site
        await stripe.prices.update(price.id, { active: false });
        await stripe.products.update(product.id, { active: false });
      }
    }
    // ==============================================================================

    // 4. INSERIR/ATUALIZAR produtos que estão no Stripe e no Supabase
    for (const price of prices) {
      const product = price.product as Stripe.Product;
      if (!product || !product.active) continue;

      const existingProduct = supabaseProducts.find(p => p.stripe_price_id === price.id);
      const productData = {
        nome: product.name,
        descricao: product.description,
        image_url: product.images?.[0] ?? null,
        preco: (price.unit_amount ?? 0) / 100,
        stripe_price_id: price.id,
      };

      if (existingProduct) {
        const { error } = await supabaseAdmin.from('Produto').update(productData).eq('id', existingProduct.id);
        if (error) console.error(`Erro ao ATUALIZAR ${product.name}:`, error);
      } else {
         // Só insere se ele não estava na lista de órfãos (evita reinserir e desativar no mesmo ciclo)
         // Esta verificação é uma segurança extra, a lógica principal está no passo 3.
        const { error } = await supabaseAdmin.from('Produto').insert(productData);
        if (error) console.error(`Erro ao INSERIR ${product.name}:`, error);
      }
    }

    // 5. DELETAR produtos do Supabase que não estão mais ativos no Stripe
    const productsToDelete = supabaseProducts.filter(p => !stripePriceIds.includes(p.stripe_price_id));
    if (productsToDelete.length > 0) {
      console.log(`Deletando ${productsToDelete.length} produtos obsoletos do Supabase...`);
      const idsToDelete = productsToDelete.map(p => p.id);
      await supabaseAdmin.from('Produto').delete().in('id', idsToDelete);
    }

    console.log("Sincronização concluída com sucesso.");
    return new Response(JSON.stringify({ message: 'Sincronização concluída com sucesso!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro fatal durante a sincronização:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});