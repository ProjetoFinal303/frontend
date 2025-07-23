// Importa as bibliotecas necessárias
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

// Inicia o cliente do Stripe com a sua chave secreta
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient()
})

// URL pública para a pasta 'site' no seu Supabase Storage.
// Esta é a URL base para encontrar seus arquivos HTML.
const YOUR_DOMAIN = 'https://ygsziltorjcgpjbmlptr.supabase.co/storage/v1/object/public/site';

// A função principal que será executada quando chamada
serve(async (req) => {
  try {
    // Pega os dados do formulário enviado pelo seu site
    const form = await req.formData()
    const lookupKey = form.get('lookup_key')

    // Validação: verifica se a chave do produto foi enviada
    if (!lookupKey) {
      throw new Error('lookup_key não foi encontrado no formulário.')
    }

    // Procura o preço do produto no Stripe usando a chave
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey as string],
      expand: ['data.product'],
    });

    // Validação: verifica se o produto existe no Stripe
    if (prices.data.length === 0) {
      throw new Error(`Nenhum preço foi encontrado no Stripe para a lookup_key: "${lookupKey}". Verifique se você criou um produto com essa chave no seu painel do Stripe.`);
    }

    const price = prices.data[0];

    // Cria a sessão de checkout (a página de pagamento do Stripe)
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: price.id, quantity: 1 }],
      mode: 'payment',
      // Define as páginas para onde o cliente será enviado após o pagamento
      success_url: `${YOUR_DOMAIN}/success.html`,
      cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    });

    // Redireciona o cliente para a página de pagamento
    return new Response(null, { status: 303, headers: { 'Location': session.url as string } })

  } catch (error) {
    // Se qualquer passo acima der errado, retorna uma mensagem de erro clara
    console.error("Erro detalhado:", error);
    return new Response(
      `Erro no Servidor: ${error.message}`,
      { status: 500 }
    )
  }
})
