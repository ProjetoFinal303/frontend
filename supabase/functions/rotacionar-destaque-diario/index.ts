// supabase/functions/rotacionar-destaque-diario/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Função "rotacionar-destaque-diario" iniciada.')

serve(async (_req) => {
  try {
    // Crie um cliente Admin do Supabase para ter permissão de alterar o banco
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Passo 1: Limpar qualquer destaque antigo para garantir que não haja duplicados.
    const { error: clearError } = await supabaseClient
      .from('produtos')
      .update({ destaque: false }) // Define todos para 'false'
      .eq('destaque', true)       // Onde o destaque era 'true'

    if (clearError) throw clearError

    // Passo 2: Escolher um novo produto aleatoriamente para ser o destaque.
    // Usamos um RPC (Remote Procedure Call) para selecionar um ID aleatório.
    const { data: randomProduct, error: rpcError } = await supabaseClient
      .rpc('get_random_product_id'); // Vamos criar essa função RPC no próximo passo.

    if (rpcError || !randomProduct || randomProduct.length === 0) {
      throw new Error('Nenhum produto encontrado para ser o novo destaque.');
    }

    const novoDestaqueId = randomProduct[0].id;

    // Passo 3: Marcar o novo produto escolhido como o destaque do dia.
    const { error: updateError } = await supabaseClient
      .from('produtos')
      .update({ destaque: true })
      .eq('id', novoDestaqueId)

    if (updateError) throw updateError

    console.log(`Sucesso! Novo produto destaque ID: ${novoDestaqueId}`)
    return new Response('Destaque do dia atualizado com sucesso!', { status: 200 })

  } catch (error) {
    console.error('Erro ao rotacionar destaque:', error.message)
    return new Response(`Erro interno: ${error.message}`, { status: 500 })
  }
})