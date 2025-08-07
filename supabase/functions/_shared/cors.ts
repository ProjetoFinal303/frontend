// supabase/functions/_shared/cors.ts

// Este ficheiro define os cabeçalhos CORS (Cross-Origin Resource Sharing).
// Eles são essenciais para permitir que o seu site (frontend), que está
// num domínio diferente, possa fazer chamadas seguras para as suas funções
// no Supabase (backend).

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permite acesso de qualquer origem. Para produção, pode restringir ao seu domínio.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

