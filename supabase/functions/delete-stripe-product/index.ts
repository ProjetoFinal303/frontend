import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.12.0'
import { corsHeaders } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const priceId = body.stripe_price_id;

    if (!priceId) {
      throw new Error("O 'stripe_price_id' é obrigatório.");
    }

    // 1. Desativa o preço no Stripe
    const price = await stripe.prices.retrieve(priceId);
    await stripe.prices.update(priceId, { active: false });

    // 2. Arquiva o produto correspondente no Stripe
    if (typeof price.product === 'string') {
      await stripe.products.update(price.product, { active: false });
    }

    // 3. Deleta o produto do seu banco de dados Supabase
    const { data: deletedProduct, error: deleteError } = await supabaseAdmin
        .from('Produto')
        .delete()
        .eq('stripe_price_id', priceId)
        .select('nome')
        .single(); // Usamos single() para verificar se algo foi realmente deletado

    if (deleteError || !deletedProduct) {
        // Se o produto não estava no DB, consideramos um sucesso parcial
        // para não bloquear o usuário. O importante é que ele sumiu do Stripe.
        console.warn(`Produto com priceId ${priceId} não foi encontrado no DB, mas foi arquivado no Stripe.`);
        return new Response(JSON.stringify({ message: `Produto arquivado no Stripe, mas já não existia no banco local.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });
    }

    return new Response(JSON.stringify({ message: `Produto '${deletedProduct.nome}' foi excluído com sucesso.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})