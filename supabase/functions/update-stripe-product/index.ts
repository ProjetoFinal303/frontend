import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@12.12.0';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stripe_price_id, nome, descricao, preco, imageUrl, quantidadeEstoque } = await req.json();

    if (!stripe_price_id) {
      throw new Error("O 'stripe_price_id' é obrigatório.");
    }

    // 1. Busca o preço antigo no Stripe para obter o ID do produto
    const oldPrice = await stripe.prices.retrieve(stripe_price_id);
    const productId = typeof oldPrice.product === 'string' ? oldPrice.product : oldPrice.product.id;

    // 2. Atualiza os detalhes do produto (nome, imagem, etc.) no Stripe
    await stripe.products.update(productId, {
        name: nome,
        description: descricao || undefined,
        images: imageUrl ? [imageUrl] : [],
    });

    // 3. Cria um novo preço, pois preços são imutáveis no Stripe
    const newPrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(preco * 100),
      currency: 'brl',
    });

    // 4. Desativa o preço antigo
    await stripe.prices.update(stripe_price_id, { active: false });

    // 5. Atualiza a tabela 'Produto' no Supabase com os novos dados
    const { data: produtoAtualizado, error: supabaseProductError } = await supabaseAdmin
      .from('Produto')
      .update({
        nome: nome,
        descricao: descricao,
        preco: preco,
        image_url: imageUrl,
        stripe_price_id: newPrice.id, // Atualiza para o novo ID de preço
      })
      .eq('stripe_price_id', stripe_price_id) // Encontra o produto pelo ID antigo
      .select('id')
      .single();

    if (supabaseProductError) throw supabaseProductError;

    // 6. Atualiza ou insere o estoque
    const { error: stockError } = await supabaseAdmin
      .from('Estoque')
      .update({ quantidade: quantidadeEstoque })
      .eq('id_produto', produtoAtualizado.id);

    // Se o update falhar (porque o produto não tinha estoque), insere um novo registro
    if (stockError) {
        const { error: insertError } = await supabaseAdmin
          .from('Estoque')
          .insert({ id_produto: produtoAtualizado.id, quantidade: quantidadeEstoque });
        if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ message: "Produto atualizado com sucesso!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
});