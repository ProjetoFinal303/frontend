import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. BUSCAR TODOS OS PRODUTOS ATIVOS DO STRIPE
    const { data: prices } = await stripe.prices.list({ active: true, expand: ['data.product'] });
    const activeStripePrices = prices.filter(p => (p.product as Stripe.Product).active);
    const activeStripePriceIds = activeStripePrices.map(p => p.id);

    // 2. FAZER O UPSERT (INSERIR NOVOS / ATUALIZAR EXISTENTES)
    if (activeStripePrices.length > 0) {
        const produtosParaSincronizar = activeStripePrices.map(price => {
            const product = price.product as Stripe.Product;
            return {
                nome: product.name,
                descricao: product.description,
                preco: (price.unit_amount || 0) / 100,
                image_url: product.images?.[0] || null,
                stripe_price_id: price.id,
            };
        });

        const { data: upsertedProducts, error: upsertError } = await supabaseAdmin
            .from('Produto')
            .upsert(produtosParaSincronizar, { onConflict: 'stripe_price_id' })
            .select();

        if (upsertError) throw upsertError;

        // Garante que produtos novos tenham uma entrada no estoque
        for (const produto of upsertedProducts) {
            const { data: estoqueExistente } = await supabaseAdmin
                .from('Estoque')
                .select('id')
                .eq('id_produto', produto.id)
                .single();
            
            if (!estoqueExistente) {
                 await supabaseAdmin.from('Estoque').insert({ id_produto: produto.id, quantidade: 0 });
            }
        }
    }

    // 3. LÓGICA DE EXCLUSÃO: ENCONTRAR E REMOVER PRODUTOS ÓRFÃOS
    const { data: supabaseProducts, error: selectError } = await supabaseAdmin
        .from('Produto')
        .select('id, stripe_price_id');

    if (selectError) throw selectError;

    const produtosParaExcluir = supabaseProducts.filter(
        p => !activeStripePriceIds.includes(p.stripe_price_id)
    );

    if (produtosParaExcluir.length > 0) {
        const idsParaExcluir = produtosParaExcluir.map(p => p.id);
        
        // Remove primeiro do estoque para evitar erro de chave estrangeira
        await supabaseAdmin
            .from('Estoque')
            .delete()
            .in('id_produto', idsParaExcluir);

        // Remove da tabela de produtos
        await supabaseAdmin
            .from('Produto')
            .delete()
            .in('id', idsParaExcluir);
    }

    const message = `Sincronização concluída. ${activeStripePrices.length} produtos atualizados/inseridos. ${produtosParaExcluir.length} produtos removidos.`;

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})