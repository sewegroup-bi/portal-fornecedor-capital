import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findFileInFolder, downloadFileText } from "@/lib/google/drive";
import { parseFornecedoresCsv } from "@/lib/import/parseFornecedores";

export const runtime = "nodejs";
export const maxDuration = 60;

const FILE_NAME = "fornecedores.csv";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  // 1) só admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) {
    return NextResponse.json({ erro: "Acesso restrito a administradores" }, { status: 403 });
  }

  // limite opcional p/ teste: /api/admin/importar?limit=500
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : null;

  try {
    // 2) buscar o CSV no Drive
    const folderId = process.env.DRIVE_ENTRADA_FOLDER_ID!;
    const file = await findFileInFolder(folderId, FILE_NAME);
    if (!file?.id) {
      return NextResponse.json(
        { erro: `Arquivo ${FILE_NAME} não encontrado na pasta de entrada` },
        { status: 404 }
      );
    }
    const csv = await downloadFileText(file.id);

    // 3) parse + validação
    const parsed = parseFornecedoresCsv(csv);
    let produtos = parsed.produtos;
    if (limit) produtos = produtos.slice(0, limit);

    const db = createAdminClient();

    // 4) upsert fornecedores (chave = cnpj) e mapear cnpj -> id
    const fornecedoresArr = Array.from(parsed.fornecedores.values());
    const cnpjToId = new Map<string, string>();
    for (const lote of chunk(fornecedoresArr, 500)) {
      const { data, error } = await db
        .from("fornecedores")
        .upsert(lote, { onConflict: "cnpj" })
        .select("id, cnpj");
      if (error) throw new Error(`fornecedores: ${error.message}`);
      for (const f of data ?? []) cnpjToId.set(f.cnpj, f.id);
    }

    // 5) upsert produtos em lotes (chave = fornecedor_id + codigo_fornecedor)
    const rows = produtos
      .map((p) => {
        const fornecedor_id = cnpjToId.get(p.cnpj);
        if (!fornecedor_id) return null;
        return {
          fornecedor_id,
          codigo_fornecedor: p.codigo_fornecedor,
          codigo_produto_ref: p.codigo_produto_ref,
          nome: p.nome,
          ean: p.ean,
          custo: p.custo,
          situacao: p.situacao,
          ativo: true,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    let gravados = 0;
    for (const lote of chunk(rows, 500)) {
      const { error } = await db
        .from("produtos")
        .upsert(lote, { onConflict: "fornecedor_id,codigo_fornecedor" });
      if (error) throw new Error(`produtos: ${error.message}`);
      gravados += lote.length;
    }

    // 6) registrar o log
    const resumo = {
      fonte: `drive:${FILE_NAME}`,
      linhas_total: parsed.total,
      linhas_ok: produtos.length,
      linhas_erro: parsed.erros.length,
      fornecedores_afetados: cnpjToId.size,
      detalhe: { amostra_erros: parsed.erros.slice(0, 50), limite_aplicado: limit },
    };
    await db.from("importacoes").insert({ executado_por: user.id, ...resumo });

    return NextResponse.json({ ok: true, gravados, ...resumo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
