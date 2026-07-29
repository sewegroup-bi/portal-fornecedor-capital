import { createClient } from "@supabase/supabase-js";

// Client com service_role — USO EXCLUSIVO NO SERVIDOR.
// Ignora RLS, então nunca importe isto em Client Components.
// Usado pela rotina de importação para gravar custos (que o fornecedor não pode escrever).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
