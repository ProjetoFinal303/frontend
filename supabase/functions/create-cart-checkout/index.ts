// supabase/functions/create-cart-checkout/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { line_items, clienteId, customerEmail } = await req.json()

    // --- VALIDAÇÃO MELHORADA APLICADA AQUI ---
    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      throw new Error('A lista de produtos (line_items) é inválida ou está vazia.')
    }
    if (!customerEmail) {
      throw new Error('O email do cliente é obrigatório.')
    }
    // Verifica se todos os itens têm um 'price' válido
    for (const item of line_items) {
        if (!item.price || typeof item.price !== 'string') {
            throw new Error(`Item inválido no carrinho. Falta o ID do preço (price).`);
        }
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
            throw new Error(`Item inválido no carrinho. A quantidade do produto ${item.price} é inválida.`);
        }
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
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
    // Retorna uma mensagem de erro mais clara
    return new Response(JSON.stringify({ error: `Falha no Servidor: ${e.message}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})