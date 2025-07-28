import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para decodificar o payload de um JWT
function decodeJWTPayload(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error("Token JWT inválido");
  }
  const payload = parts[1];
  const decoded = new TextDecoder().decode(decode(payload));
  return JSON.parse(decoded);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { id_token } = await req.json()
    if (!id_token) {
      throw new Error("O 'id_token' do Google não foi fornecido.")
    }

    // Decodifica o payload do token de forma segura
    const googleUser = decodeJWTPayload(id_token);

    if (!googleUser.email || !googleUser.name) {
      throw new Error('Payload do token inválido ou não contém email/nome.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let { data: cliente, error: findError } = await supabaseAdmin
      .from('Cliente')
      .select('*')
      .eq('email', googleUser.email)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      throw findError
    }

    if (!cliente) {
      const { data: novoCliente, error: insertError } = await supabaseAdmin
        .from('Cliente')
        .insert({
          nome: googleUser.name,
          email: googleUser.email,
          contato: '',
          senha: '', 
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }
      cliente = novoCliente
    }

    return new Response(JSON.stringify(cliente), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})