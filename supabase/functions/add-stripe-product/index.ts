// supabase/functions/add-stripe-product/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- CORREÇÃO APLICADA AQUI ---
    // Agora recebemos o 'imageUrl' do frontend.
    const { productName, unitAmount, imageUrl } = await req.json()

    // Validação básica
    if (!productName || !unitAmount) {
        throw new Error("O nome do produto e o preço são obrigatórios.");
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // --- CORREÇÃO APLICADA AQUI ---
    // Criamos um objeto de dados do produto e adicionamos o campo 'images' se o imageUrl existir.
    const productData: Stripe.ProductCreateParams = {
        name: productName,
    };

    if (imageUrl) {
        productData.images = [imageUrl];
    }

    // Cria o produto no Stripe com os dados (e a imagem, se disponível)
    const product = await stripe.products.create(productData);

    // Cria o preço para o produto
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount, // O preço deve ser em centavos
      currency: 'brl', // Moeda brasileira
    })

    // Retorna o ID do preço para o frontend
    return new Response(JSON.stringify({ priceId: price.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Erro na função add-stripe-product:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})