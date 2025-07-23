import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

// CORREÇÃO: Usa o nome do segredo correto (sem o prefixo SUPABASE_)
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
      const customerEmail = session.customer_details?.email;
      if (!customerEmail) throw new Error("Email do cliente não encontrado.");

      let { data: cliente } = await supabaseAdmin.from('Cliente').select('id').eq('email', customerEmail).single();

      if (!cliente) {
        const { data: novoCliente } = await supabaseAdmin.from('Cliente').insert({ email: customerEmail, nome: session.customer_details?.name || 'Não informado', contato: 'Não informado', senha: 'NAO_USAR' }).select('id').single();
        cliente = novoCliente;
      }

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      for (const item of lineItems.data) {
        await supabaseAdmin.from('Pedido').insert({ id_cliente: cliente.id, descricao: item.description, valor: item.amount_total / 100, data: new Date().toISOString(), status: 'Pago' });
      }
    } catch (error) {
      return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
})

