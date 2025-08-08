// supabase/functions/create-cart-checkout/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * NOTA IMPORTANTE:
 * Certifique-se de que esta função tem os "Secrets" configurados no seu
 * painel do Supabase, tal como fizemos com as outras:
 * - STRIPE_API_KEY: A sua chave secreta do Stripe.
 * - SITE_URL: O URL completo do seu site (ex: https://seu-site.vercel.app)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { line_items, clienteId, customerEmail } = await req.json()

    // Validação dos dados recebidos
    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      throw new Error('A lista de produtos (line_items) é inválida ou está vazia.')
    }
    if (!customerEmail) {
      throw new Error('O email do cliente é obrigatório.')
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Cria a sessão de checkout no Stripe com múltiplos itens
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items, // A lista de produtos vem diretamente do frontend
      mode: 'payment',
      success_url: `${Deno.env.get('SITE_URL')}/success.html`,
      cancel_url: `${Deno.env.get('SITE_URL')}/catalog.html`,
      customer_email: customerEmail,
      metadata: {
        cliente_id: clienteId,
      },
    })

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('Erro na função create-cart-checkout:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
