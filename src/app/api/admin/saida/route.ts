import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// escapa um campo para CSV (aspas quando houver separador, aspas ou quebra de linha)
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  // só admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) {
    return NextResponse.json({ erro: "Acesso restrito a administradores" }, { status: 403 });
  }

  // lê a view via service_role (a view já respeita RLS, mas aqui queremos o dataset completo)
  const db = createAdminClient();
  const { data, error } = await db
    .from("saida_pedidos")
    .select("*")
    .order("data_registro", { ascending: true });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const colunas = [
    "pedido_id",
    "data_registro",
    "fornecedor_codigo",
    "fornecedor_nome",
    "fornecedor_documento",
    "fornecedor_documento_tipo",
    "produto_codigo",
    "produto_ref",
    "produto_nome",
    "ean",
    "situacao",
    "quantidade",
    "custo_unitario",
    "subtotal",
    "pedido_total",
    "ciente_valores",
    "ciente_em",
    "observacao",
  ];

  const linhas = (data ?? []).map((r) =>
    colunas.map((c) => csvCell((r as Record<string, unknown>)[c])).join(",")
  );
  // BOM UTF-8 para o Excel (Windows) exibir acentos corretamente
  const csv = "﻿" + [colunas.join(","), ...linhas].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="saida_pedidos.csv"`,
    },
  });
}
