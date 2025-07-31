// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

// Headers de CORS que estavam faltando
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

serve(async (req) => {
  // ESSA PARTE É ESSENCIAL PARA O CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { produto } = await req.json();
    if (!produto) {
      throw new Error("Dados do produto não fornecidos.");
    }

    const isDestaque = produto.destaque === true;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
            currency: 'brl',
            product_data: {
                name: produto.nome,
                images: produto.imagem_url ? [produto.imagem_url] : [],
            },
            unit_amount: Math.round(produto.preco * 100),
        },
        quantity: 1,
      }],
      success_url: `https://frontend-gamma-one-19.vercel.app/success.html`,
      cancel_url: `https://frontend-gamma-one-19.vercel.app/cancel.html`,
      
      // Aplica o cupom se for um destaque oficial
      ...(isDestaque && {
        discounts: [{
          coupon: 'DESTAQUE10', // Cupom que criamos no Stripe
        }]
      })
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      // ADICIONADO O HEADER DE CORS NA RESPOSTA
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      // ADICIONADO O HEADER DE CORS NA RESPOSTA DE ERRO
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})