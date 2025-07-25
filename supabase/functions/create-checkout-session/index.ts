import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

// Headers para permitir o acesso do seu site (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

const YOUR_DOMAIN = 'https://frontend-gamma-one-19.vercel.app'

serve(async (req) => {
  // Trata a requisição OPTIONS (necessária para CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, clienteId, customerEmail } = await req.json();

    if (!priceId) {
      throw new Error('ID do preço (priceId) não foi encontrado.');
    }
    if (!clienteId) {
        throw new Error('ID do cliente (clienteId) não foi encontrado.');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [{
          price: priceId,
          quantity: 1
      }],
      client_reference_id: String(clienteId), 
      success_url: `${YOUR_DOMAIN}/success.html`,
      cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    });

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('Erro na função create-checkout-session:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
    });
  }
})