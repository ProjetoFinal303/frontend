import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// O Deno Deploy exige que as variáveis de ambiente sejam definidas explicitamente.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Ouve as requisições
Deno.serve(async (req) => {
  // Lida com a requisição pre-flight OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extrai o id_token do corpo da requisição
    const { id_token } = await req.json();
    if (!id_token) {
      throw new Error('O token do Google (id_token) não foi fornecido.');
    }

    // Cria um cliente Supabase com privilégios de administrador para autenticação
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Usa o método padrão do Supabase para fazer login com o token do Google.
    // Isso verifica o token, cria um usuário em `auth.users` se ele não existir,
    // e retorna uma sessão completa.
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithIdToken({
      provider: 'google',
      token: id_token,
    });

    if (sessionError) {
      console.error('Erro na autenticação com o Supabase:', sessionError.message);
      throw sessionError;
    }
    
    if (!sessionData || !sessionData.user) {
        throw new Error("Não foi possível obter os dados do usuário a partir da sessão do Google.");
    }

    const user = sessionData.user;
    
    // Agora, usamos os dados do usuário autenticado para criar ou atualizar o perfil
    // na sua tabela pública `Cliente`.
    const { error: upsertError } = await supabaseAdmin
      .from('Cliente')
      .upsert({
        id: user.id, // Garante que o ID na tabela `Cliente` seja o mesmo que o ID de autenticação
        nome: user.user_metadata.full_name || user.user_metadata.name,
        email: user.email,
        avatar_url: user.user_metadata.avatar_url,
        // Campos que não vêm do Google, mas podem ter um valor padrão
        contato: user.phone || 'Não informado',
        senha: 'GOOGLE_AUTH', // Define um valor placeholder para a senha
        role: 'user' // Define a role padrão para novos usuários do Google
      }, { onConflict: 'id' }); // `onConflict` garante que, se o usuário já existir, ele será atualizado (update) em vez de dar erro.

    if (upsertError) {
      console.error('Erro ao salvar o perfil do cliente:', upsertError.message);
      throw upsertError;
    }

    // Retorna a sessão completa para o aplicativo. A `LoginActivity` já está preparada
    // para receber este objeto e extrair o `access_token` e os dados do usuário.
    return new Response(JSON.stringify(sessionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro inesperado:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
