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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    
    // CORREÇÃO: Lemos a 'categoria' e 'quantidadeEstoque' que vêm do site/app
    const { nome, descricao, preco, imageUrl, quantidadeEstoque, categoria } = payload;

    if (!nome || !preco) {
      throw new Error("O nome do produto e o preço são obrigatórios.");
    }

    // 1. Criar o produto no Stripe
    const produtoStripe = await stripe.products.create({
      name: nome,
      description: descricao || undefined,
      images: imageUrl ? [imageUrl] : [],
    });

    // 2. Criar o preço para o produto no Stripe
    const precoStripe = await stripe.prices.create({
      product: produtoStripe.id,
      unit_amount: Math.round(preco * 100),
      currency: 'brl',
    });

    // 3. Inserir o produto no banco de dados, AGORA INCLUINDO A CATEGORIA
    const { data: produtoInserido, error: supabaseError } = await supabaseAdmin
      .from('Produto')
      .insert({
        nome: nome,
        descricao: descricao,
        preco: preco,
        image_url: imageUrl,
        stripe_price_id: precoStripe.id,
        categoria: categoria, // <-- CAMPO CORRIGIDO
      })
      .select('id')
      .single();

    if (supabaseError) {
      throw supabaseError;
    }

    // 4. Inserir o estoque inicial com a QUANTIDADE recebida do formulário
    const estoqueInicial = quantidadeEstoque || 0;
    const { error: estoqueError } = await supabaseAdmin
      .from('Estoque')
      .insert({
        id_produto: produtoInserido.id,
        quantidade: estoqueInicial,
      });
      
    if (estoqueError) {
      // Não lançamos um erro aqui, pois o estoque pode falhar sem quebrar a operação principal
      console.error("Aviso: Erro ao inserir estoque para o novo produto:", estoqueError);
    }

    return new Response(JSON.stringify({
        message: `Produto '${nome}' adicionado com sucesso!`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})