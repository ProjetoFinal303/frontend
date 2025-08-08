// supabase/functions/add-stripe-product/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { productName, unitAmount } = await req.json()

    // CORREÇÃO: A função agora procura pela variável de ambiente 'STRIPE_API_KEY',
    // que é o nome que você configurou no seu painel do Supabase.
    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Cria o produto no Stripe
    const product = await stripe.products.create({
      name: productName,
    })

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
