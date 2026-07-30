import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executarImportacao } from "@/lib/import/executarImportacao";

export const runtime = "nodejs";
export const maxDuration = 300;

// Atualização imediata do catálogo, disparada pelo admin.
// forcar = true: atualiza mesmo que o arquivo não tenha mudado.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) {
    return NextResponse.json({ erro: "Acesso restrito a administradores" }, { status: 403 });
  }

  try {
    const r = await executarImportacao({
      executadoPor: user.id,
      automatica: false,
      forcar: true,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    await createAdminClient().from("importacoes").insert({
      executado_por: user.id,
      automatica: false,
      resultado: "erro",
      fonte: "drive:fornecedores.csv",
      detalhe: { erro: msg },
    });
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
