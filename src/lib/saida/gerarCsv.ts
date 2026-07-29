import type { SupabaseClient } from "@supabase/supabase-js";

const COLUNAS = [
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

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Gera o CSV da saída (view saida_pedidos), com BOM UTF-8 para o Excel.
export async function gerarSaidaCsv(db: SupabaseClient): Promise<string> {
  const { data, error } = await db
    .from("saida_pedidos")
    .select("*")
    .order("data_registro", { ascending: true });
  if (error) throw new Error(error.message);

  const linhas = (data ?? []).map((r) =>
    COLUNAS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(",")
  );
  return "﻿" + [COLUNAS.join(","), ...linhas].join("\n");
}
