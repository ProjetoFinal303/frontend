import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

const YOUR_DOMAIN = 'https://frontend-gamma-one-19.vercel.app'

serve(async (req) => {
  try {
    // Agora esperamos também o 'clienteId'
    const { cartItems, customerEmail, clienteId } = await req.json()

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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: line_items,
      // A MÁGICA ACONTECE AQUI: enviamos o ID do cliente para o Stripe
      client_reference_id: clienteId, 
      success_url: `${YOUR_DOMAIN}/success.html`,
      cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    });

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro na função create-mobile-checkout:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
    });
  }
})