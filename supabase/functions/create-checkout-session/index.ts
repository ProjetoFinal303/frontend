// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * NOTA IMPORTANTE DE SEGURANÇA:
 * A sua chave 'STRIPE_API_KEY' NUNCA deve ser exposta no frontend.
 * Ela deve ser configurada como um "Secret" no seu painel do Supabase.
 * 1. Vá para o seu projeto no Supabase -> Edge Functions.
 * 2. Selecione a função 'create-checkout-session'.
 * 3. Vá para a aba 'Secrets'.
 * 4. Adicione um novo segredo com o nome 'STRIPE_API_KEY' e cole a sua
 * chave secreta do Stripe (que começa com 'sk_...') no valor.
 * 5. Faça o deploy da função novamente após adicionar o segredo.
 */

// Inicializa o cliente do Stripe com a chave de API das variáveis de ambiente
const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // Trata requisições OPTIONS para CORS (necessário para o navegador)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, clienteId, customerEmail } = await req.json()

    // Validação dos dados recebidos do frontend
    if (!priceId) {
      throw new Error('O ID do preço (priceId) é obrigatório.')
    }
    if (!customerEmail) {
        throw new Error('O email do cliente é obrigatório.')
    }

    // Cria a sessão de checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      // URLs de redirecionamento após a compra
      success_url: `${Deno.env.get('SITE_URL')}/success.html`,
      cancel_url: `${Deno.env.get('SITE_URL')}/catalog.html`,
      customer_email: customerEmail,
      // Metadados para associar a compra ao cliente no seu banco de dados
      metadata: {
        cliente_id: clienteId,
      },
    })

    // Retorna a URL de checkout para o frontend
    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('Erro na função create-checkout-session:', e)
    
    // Lógica para retornar mensagens de erro mais claras e úteis
    let errorMessage = 'Ocorreu um erro desconhecido.'
    if (e.message.includes('No such price')) {
        errorMessage = `O ID de preço fornecido não foi encontrado no Stripe. Verifique se o produto está corretamente sincronizado.`
    } else if (e.message.includes('API key')) {
        errorMessage = 'A chave de API do Stripe não está configurada corretamente. Verifique os "Secrets" da sua função no painel do Supabase.'
    } else {
        errorMessage = e.message
    }
    
    return new Response(JSON.stringify({ error: `Falha no Servidor: ${errorMessage}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
