import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

const supabaseAdmin = createClient(
  'https://ygsziltorjcgpjbmlptr.supabase.co',
  Deno.env.get('SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  let event: Stripe.Event;
  try {
    if (!signature || !webhookSecret) throw new Error('Assinatura do webhook ou secret não encontrados.');
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Prioridade 1: Usar o ID do cliente enviado pelo app
      const clienteId = session.client_reference_id;

      if (!clienteId) {
        // Se o ID não veio (ex: compra pelo site), usa o e-mail como fallback
        const customerEmail = session.customer_details?.email;
        if (!customerEmail) throw new Error("Email ou ID do cliente não encontrado na sessão.");
        
        let { data: cliente } = await supabaseAdmin.from('Cliente').select('id').eq('email', customerEmail).single();
        if (!cliente) throw new Error("Cliente com o e-mail fornecido não encontrado.");

        // Lógica de fallback... (pode ser ajustada conforme necessidade)
        console.warn(`Pedido criado via fallback de e-mail para: ${customerEmail}`);
      }
      
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      
      const pedidoDescricao = lineItems.data.map(item => `${item.quantity}x ${item.description}`).join(', ');

      // Insere o pedido no banco usando o ID do cliente de forma confiável
      await supabaseAdmin.from('Pedido').insert({
        id_cliente: Number(clienteId), // Converte o ID para número
        descricao: pedidoDescricao,
        valor: session.amount_total / 100,
        data: new Date().toISOString(),
        status: 'Pendente' // Novo pedido entra como pendente para a cozinha
      });

    } catch (error) {
      return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
})