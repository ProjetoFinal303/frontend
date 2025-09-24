import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from "https://esm.sh/stripe@10.12.0";
import { corsHeaders } from '../_shared/cors.ts';

// Inicializa o cliente do Stripe com a chave da variável de ambiente
const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") as string, {
  apiVersion: "2022-11-15",
});

// Inicializa o cliente do Supabase
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Pega a URL do site da variável de ambiente. Mais flexível e seguro.
const SITE_URL = Deno.env.get('SITE_URL');

serve(async (req) => {
  // Trata a requisição OPTIONS para CORS (Cross-Origin Resource Sharing)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cart, customerId } = await req.json();

    if (!cart || !customerId) {
      throw new Error("Carrinho e ID do cliente são obrigatórios.");
    }
     if (!SITE_URL) {
      throw new Error("A variável de ambiente SITE_URL não foi configurada.");
    }
    
    // Busca o stripe_customer_id do cliente no seu banco de dados Supabase
    const { data: cliente, error: clienteError } = await supabase
      .from('Cliente')
      .select('stripe_customer_id')
      .eq('id', customerId)
      .single();

    if (clienteError) throw clienteError;
    if (!cliente || !cliente.stripe_customer_id) {
        throw new Error("Cliente não encontrado ou sem ID do Stripe.");
    }

    // Mapeia os itens do carrinho para o formato que a API do Stripe espera
    const line_items = cart.map((item: any) => ({
      price: item.stripe_price_id,
      quantity: item.quantity,
    }));

    // Cria a sessão de checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      customer: cliente.stripe_customer_id,
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      // URLs de sucesso e cancelamento agora usam a variável de ambiente
      success_url: `${SITE_URL}/success.html`,
      cancel_url: `${SITE_URL}/cancel.html`,
      locale: 'pt-BR'
    });

    // Retorna o ID da sessão para o frontend
    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    // Retorna uma resposta de erro caso algo dê errado
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});