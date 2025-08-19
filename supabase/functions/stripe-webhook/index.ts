// supabase/functions/stripe-webhook/index.ts
// ESTA É A VERSÃO CORRIGIDA E BLINDADA. SUBSTITUA TODO O SEU ARQUIVO POR ESTE CÓDIGO.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuração do cliente do Stripe com a chave secreta do ambiente
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

// Cliente Admin do Supabase: usa a SERVICE_ROLE_KEY para ter permissão total de escrita
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  let event: Stripe.Event;
  try {
    if (!signature || !webhookSecret) {
      throw new Error('Assinatura do webhook ou secret não configurados no ambiente.');
    }
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (err) {
    console.error(`❌ Erro na construção do evento do webhook: ${err.message}`);
    return new Response(err.message, { status: 400 });
  }

  // Processa apenas o evento que confirma o sucesso do pagamento
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`✅ Evento 'checkout.session.completed' recebido para a sessão: ${session.id}`);

    try {
      let clienteId: number | null = null;

      // --- LÓGICA DE ASSOCIAÇÃO DE CLIENTE (O CORAÇÃO DA CORREÇÃO) ---

      // PRIORIDADE 1: Tenta pegar o ID diretamente dos metadados da sessão.
      // É o método mais confiável, enviado pelo seu frontend.
      if (session.metadata?.cliente_id) {
        const parsedId = parseInt(session.metadata.cliente_id, 10);
        if (!isNaN(parsedId)) {
          clienteId = parsedId;
          console.log(`Cliente ID [${clienteId}] encontrado nos metadados.`);
        } else {
          console.warn(`cliente_id [${session.metadata.cliente_id}] nos metadados não é um número válido.`);
        }
      }

      // PRIORIDADE 2 (FALLBACK): Se o ID não veio ou era inválido, usa o email como plano B.
      if (!clienteId && session.customer_details?.email) {
        const customerEmail = session.customer_details.email;
        console.log(`ID do cliente não encontrado. Usando fallback de e-mail: ${customerEmail}`);
        
        const { data: clientePorEmail, error: emailError } = await supabaseAdmin
            .from('Cliente')
            .select('id')
            .eq('email', customerEmail)
            .single();

        if (emailError) {
          console.error(`Erro ao buscar cliente pelo e-mail [${customerEmail}]:`, emailError.message);
        } else if (clientePorEmail) {
          clienteId = clientePorEmail.id;
          console.log(`Cliente ID [${clienteId}] encontrado via fallback de e-mail.`);
        } else {
           console.warn(`Nenhum cliente encontrado com o e-mail: ${customerEmail}`);
        }
      }

      // Se após todas as tentativas o ID do cliente ainda for nulo, é um erro fatal.
      if (!clienteId) {
        throw new Error(`FATAL: Não foi possível associar o pedido da sessão Stripe [${session.id}] a nenhum cliente.`);
      }
      
      // Busca os itens da compra para montar a descrição
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const pedidoDescricao = lineItems.data.map(item => `${item.quantity}x ${item.description}`).join(', ');

      // Monta o objeto do novo pedido
      const novoPedido = {
        id_cliente: clienteId,
        descricao: pedidoDescricao,
        valor: session.amount_total ? session.amount_total / 100 : 0,
        data: new Date().toISOString(),
        status: 'pendente' // Status inicial para a cozinha
      };

      // Insere o pedido no banco de dados
      const { error: insertError } = await supabaseAdmin.from('Pedido').insert(novoPedido);

      if (insertError) {
        throw new Error(`Erro ao inserir o pedido no banco de dados: ${insertError.message}`);
      }

      console.log(`🎉 Pedido para o cliente [${clienteId}] criado com sucesso!`);

    } catch (error) {
      console.error(`❌ Erro Crítico ao processar o webhook: ${error.message}`);
      // Retorna 400 para que o Stripe saiba que algo deu errado e possa tentar de novo.
      return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }
  }

  // Retorna 200 para o Stripe confirmando o recebimento do evento
  return new Response(JSON.stringify({ received: true }), { status: 200 });
})
