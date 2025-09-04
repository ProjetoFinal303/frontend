import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0'
import { corsHeaders } from '../_shared/cors.ts'

// O Stripe exige que a chave da API seja passada para a função
const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // Tratamento de CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { line_items, clienteId, customerEmail } = await req.json()

    // Validação robusta dos dados recebidos
    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      throw new Error('A lista de produtos (line_items) é inválida ou está vazia.')
    }
    if (!customerEmail) {
      throw new Error('O email do cliente é obrigatório.')
    }

    // Cria a sessão de checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${Deno.env.get('SITE_URL')}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('SITE_URL')}/catalog.html`,
      customer_email: customerEmail,
      line_items: line_items, // Passa diretamente o array de line_items com preços dinâmicos
      metadata: {
        cliente_id: clienteId,
      },
    })

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Erro na função create-checkout-session:', error)
    return new Response(JSON.stringify({ error: `Falha no Servidor: ${error.message}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

---

### **Passo 2: Fazer o Deploy da Função Corrigida**

Agora, abra o **PowerShell**, navegue até à pasta do seu projeto e execute este comando para enviar a correção para o Supabase:

```powershell
supabase functions deploy create-checkout-session --project-ref ygsziltorjcgpjbmlptr
