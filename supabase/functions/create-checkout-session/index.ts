import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

// Inicia o cliente do Stripe com a sua chave secreta
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

// URL do seu site na Vercel (JÁ ATUALIZADA)
const YOUR_DOMAIN = 'https://frontend-gamma-one-19.vercel.app' 

serve(async (req) => {
  try {
    const form = await req.formData()
    const lookupKey = form.get('lookup_key')

    if (!lookupKey) {
      throw new Error('Lookup key não foi encontrada no formulário.');
    }

    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey as string],
      expand: ['data.product'],
    });

    if (prices.data.length === 0) {
      throw new Error(`Nenhum preço encontrado para a lookup_key: ${lookupKey}`);
    }

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      mode: 'payment',
      // AQUI ESTÁ A MUDANÇA: Usamos a nova URL da Vercel
      success_url: `${YOUR_DOMAIN}/success.html`,
      cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    });

    // Redireciona o usuário para a página de pagamento do Stripe
    return new Response(null, { status: 303, headers: { 'Location': session.url as string } })

  } catch (error) {
    console.error('Erro na função create-checkout-session:', error.message);
    // Retorna um erro claro que você pode ver no navegador
    return new Response(`Erro no servidor: ${error.message}`, { status: 500 });
  }
})
