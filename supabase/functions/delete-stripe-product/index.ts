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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ---> INÍCIO DA CORREÇÃO: Bloco de segurança removido <---
    const { stripe_price_id } = await req.json();
    if (!stripe_price_id) {
      throw new Error("ID do preço do Stripe (stripe_price_id) é obrigatório.");
    }

    // 1. Pega os detalhes do preço para encontrar a ID do produto
    const price = await stripe.prices.retrieve(stripe_price_id);
    const productId = typeof price.product === 'string' ? price.product : price.product.id;

    // 2. Desativa o preço
    await stripe.prices.update(stripe_price_id, { active: false });

    // 3. Arquiva (desativa) o produto
    await stripe.products.update(productId, { active: false });

    return new Response(JSON.stringify({ message: "Produto removido com sucesso no Stripe!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})