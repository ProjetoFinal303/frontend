// supabase/functions/delete-stripe-product/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId } = await req.json()

    // CORREÇÃO: A função agora procura pela variável de ambiente 'STRIPE_API_KEY',
    // que é o nome que você configurou no seu painel do Supabase.
    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Desativar um preço é a forma correta de o "remover" no Stripe.
    const price = await stripe.prices.update(priceId, { active: false })

    return new Response(JSON.stringify({ message: `Price ${price.id} deactivated.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Erro na função delete-stripe-product:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
