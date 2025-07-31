import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: products, error } = await supabaseClient
      .from('Produto')
      .select('*');

    if (error || !products || products.length === 0) {
      throw new Error('Nenhum produto encontrado no banco de dados.');
    }

    // A mesma lógica de antes, agora centralizada
    const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const productIndex = daysSinceEpoch % products.length;
    const featuredProduct = products[productIndex];

    return new Response(JSON.stringify(featuredProduct), {
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