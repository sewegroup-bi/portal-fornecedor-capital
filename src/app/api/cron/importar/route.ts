import { NextRequest, NextResponse } from "next/server";
import { executarImportacao } from "@/lib/import/executarImportacao";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Importação automática (agendada). Protegida por CRON_SECRET — a Vercel envia
// esse header automaticamente nos cron jobs quando a variável está definida.
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurada" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await executarImportacao({ automatica: true });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    // registra a falha para aparecer no histórico do admin
    await createAdminClient()
      .from("importacoes")
      .insert({
        automatica: true,
        resultado: "erro",
        fonte: "drive:fornecedores.csv",
        detalhe: { erro: msg },
      });
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
