import { createBrowserClient } from "@supabase/ssr";

// Client para uso no navegador (Client Components). Usa a anon key — RLS protege os dados.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
