import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Trata a requisição OPTIONS (necessária para CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clienteId } = await req.json()
    if (!clienteId) {
      throw new Error("ID do Cliente não foi fornecido.");
    }

    // Cria um cliente Supabase com a chave de administrador para poder ler a tabela
    const supabaseAdmin = createClient(
      // Essas variáveis são seguras, pois a função roda no servidor
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Busca os pedidos na tabela 'Pedido' filtrando pelo id_cliente
    const { data, error } = await supabaseAdmin
      .from('Pedido')
      .select('*')
      .eq('id_cliente', clienteId)
      .order('data', { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})