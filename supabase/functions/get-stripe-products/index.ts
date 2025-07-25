import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

serve(async (_req) => {
  try {
    const { data: prices } = await stripe.prices.list({
      active: true, // Garante que o PREÇO está ativo
      expand: ['data.product'],
    });

    // Filtra para garantir que o PRODUTO também está ativo
    const activeProducts = prices.filter(price => {
        const product = price.product as Stripe.Product;
        return product.active; // Só inclui se o produto não estiver arquivado
    });

    // Formata os dados para o app mobile
    const products = activeProducts.map((price) => {
      const product = price.product as Stripe.Product;
      return {
        id: price.id,
        name: product.name,
        description: product.description || 'Sem descrição',
        price: (price.unit_amount || 0) / 100,
        imageUrl: product.images?.[0] || null,
      };
    });

    return new Response(JSON.stringify(products), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao buscar produtos do Stripe:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
    });
  }
})