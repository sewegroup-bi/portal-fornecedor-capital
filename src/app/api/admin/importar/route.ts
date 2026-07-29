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
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) {
    return NextResponse.json({ erro: "Acesso restrito a administradores" }, { status: 403 });
  }

  // paginação opcional: ?limit=500&offset=0
  const limitParam = req.nextUrl.searchParams.get("limit");
  const offsetParam = req.nextUrl.searchParams.get("offset");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : null;
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0;

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

    // 3) parse + validação (CNPJ/CPF não bloqueia mais)
    const parsed = parseFornecedoresCsv(csv);
    let produtos = parsed.produtos;
    if (limit) produtos = produtos.slice(offset, offset + limit);

    const db = createAdminClient();

    // 4) upsert fornecedores (chave = codigo_fabricante) e mapear -> id
    const fornecedoresArr = Array.from(parsed.fornecedores.values());
    const docTipos = { CNPJ: 0, CPF: 0, INVALIDO: 0 };
    for (const f of fornecedoresArr) docTipos[f.documento_tipo]++;

    const codToId = new Map<string, string>();
    for (const lote of chunk(fornecedoresArr, 500)) {
      const { data, error } = await db
        .from("fornecedores")
        .upsert(lote, { onConflict: "codigo_fabricante" })
        .select("id, codigo_fabricante");
      if (error) throw new Error(`fornecedores: ${error.message}`);
      for (const f of data ?? []) codToId.set(f.codigo_fabricante as string, f.id);
    }

    // 5) upsert produtos em lotes (chave = fornecedor_id + codigo_fornecedor)
    const rows = produtos
      .map((p) => {
        const fornecedor_id = codToId.get(p.codigo_fabricante);
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

    // 6) log
    const resumo = {
      fonte: `drive:${FILE_NAME}`,
      linhas_total: parsed.total,
      linhas_ok: produtos.length,
      linhas_erro: parsed.erros.length,
      fornecedores_afetados: codToId.size,
      detalhe: {
        documentos: docTipos, // quantos CNPJ / CPF / INVALIDO
        amostra_erros: parsed.erros.slice(0, 50),
        paginacao: { limit, offset },
      },
    };
    await db.from("importacoes").insert({ executado_por: user.id, ...resumo });

    return NextResponse.json({ ok: true, gravados, ...resumo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
