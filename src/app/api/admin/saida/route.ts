import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarSaidaCsv } from "@/lib/saida/gerarCsv";

export const runtime = "nodejs";

const FILE_NAME = "saida_pedidos.csv";
const BUCKET = "saida";

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

// GET: download direto do CSV
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

// POST: gera o CSV e grava no Storage (bucket "saida"), retornando URL assinada.
export async function POST() {
  const auth = await exigirAdmin();
  if ("erro" in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status });

  try {
    const db = createAdminClient();
    const csv = await gerarSaidaCsv(db);

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(FILE_NAME, Buffer.from(csv, "utf-8"), {
        upsert: true,
        contentType: "text/csv; charset=utf-8",
      });
    if (upErr) throw new Error(upErr.message);

    // URL assinada de longa duração (1 ano) para o consumidor puxar
    const { data: signed, error: signErr } = await db.storage
      .from(BUCKET)
      .createSignedUrl(FILE_NAME, 60 * 60 * 24 * 365);
    if (signErr) throw new Error(signErr.message);

    return NextResponse.json({ ok: true, arquivo: FILE_NAME, url: signed?.signedUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
