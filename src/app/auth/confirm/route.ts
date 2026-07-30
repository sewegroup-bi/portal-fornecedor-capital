import { NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Destino do link enviado por e-mail (convite / redefinição de senha).
// Aceita os dois formatos que o Supabase pode usar: token_hash+type e code.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}/definir-senha`);
    return NextResponse.redirect(
      `${origin}/login?erro=${encodeURIComponent("Link inválido ou expirado")}`
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/definir-senha`);
  }

  return NextResponse.redirect(
    `${origin}/login?erro=${encodeURIComponent("Link inválido ou expirado")}`
  );
}
