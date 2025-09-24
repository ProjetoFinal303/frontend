import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from "https://esm.sh/stripe@10.12.0";
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") as string, {
  apiVersion: "2022-11-15",
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cart, customerId } = await req.json();

    if (!cart || !customerId) {
      throw new Error("Carrinho e ID do cliente são obrigatórios.");
    }
    
    // Pega o id do cliente no supabase e transforma no id do stripe
    const { data: cliente, error: clienteError } = await supabase
      .from('Cliente')
      .select('stripe_customer_id')
      .eq('id', customerId)
      .single();

    if (clienteError) throw clienteError;
    if (!cliente || !cliente.stripe_customer_id) {
        throw new Error("Cliente não encontrado ou sem ID do Stripe.");
    }

    const line_items = cart.map((item: any) => ({
      price: item.stripe_price_id,
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      customer: cliente.stripe_customer_id,
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `https://lancho.vercel.app/success.html`, // <-- URL CORRIGIDA AQUI
      cancel_url: `https://lancho.vercel.app/cancel.html`,   // <-- E AQUI
      locale: 'pt-BR'
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});