import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarSaidaCsv } from "@/lib/saida/gerarCsv";
import { uploadOrUpdateTextFile } from "@/lib/google/drive";

export const runtime = "nodejs";

const FILE_NAME = "saida_pedidos.csv";

async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autenticado", status: 401 as const };
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) return { erro: "Acesso restrito a administradores", status: 403 as const };
  return { user };
}

// GET: download do CSV
export async function GET() {
  const auth = await exigirAdmin();
  if ("erro" in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status });

  try {
    const csv = await gerarSaidaCsv(createAdminClient());
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${FILE_NAME}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

// POST: gera e grava o CSV na pasta SAÍDA do Drive
export async function POST() {
  const auth = await exigirAdmin();
  if ("erro" in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status });

  const folderId = process.env.DRIVE_SAIDA_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json(
      { erro: "DRIVE_SAIDA_FOLDER_ID não configurada" },
      { status: 500 }
    );
  }

  try {
    const csv = await gerarSaidaCsv(createAdminClient());
    const file = await uploadOrUpdateTextFile(folderId, FILE_NAME, csv);
    return NextResponse.json({ ok: true, arquivo: file?.name, link: file?.webViewLink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
