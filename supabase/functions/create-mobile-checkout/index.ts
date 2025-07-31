import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { cartItems, customerEmail, clienteId, applyDiscount } = await req.json()

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw new Error('Itens do carrinho inválidos.');
    }
    if (!clienteId) {
      throw new Error('ID do cliente não fornecido.');
    }

    const line_items = cartItems.map(item => ({
      price: item.priceId,
      quantity: item.quantity,
    }));
    
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: customerEmail,
        line_items: line_items,
        client_reference_id: String(clienteId), 
        success_url: `${YOUR_DOMAIN}/success.html`,
        cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    };

    if (applyDiscount) {
        sessionOptions.discounts = [{ coupon: 'DESTAQUE10' }];
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    });
  }
})