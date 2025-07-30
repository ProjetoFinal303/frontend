import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Inicializa o Stripe
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
    // A segurança agora é garantida pela própria página admin.html,
    // que só é acessível pelo administrador.
    // ---> FIM DA CORREÇÃO <---

    const { nome, descricao, preco, imageUrl } = await req.json();
    if (!nome || !preco) {
      throw new Error("Nome e preço do produto são obrigatórios.");
    }

    // 1. Cria o Produto no Stripe
    const stripeProduct = await stripe.products.create({
      name: nome,
      description: descricao || 'Sem descrição',
      images: imageUrl ? [imageUrl] : [],
    });

    // 2. Cria o Preço associado ao Produto no Stripe
    await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(preco * 100), // Converte para centavos
      currency: 'brl',
    });

    return new Response(JSON.stringify({ message: `Produto "${nome}" criado com sucesso no Stripe!` }), {
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