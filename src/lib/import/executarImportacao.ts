import { createAdminClient } from "@/lib/supabase/admin";
import { findFileInFolder, downloadFileText } from "@/lib/google/drive";
import { parseFornecedoresCsv } from "@/lib/import/parseFornecedores";

export const ARQUIVO_ENTRADA = "fornecedores.csv";

// lotes grandes: menos idas ao banco = importação completa dentro do tempo da função
const LOTE = 2000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type ResultadoImportacao = {
  resultado: "importado" | "sem_alteracao";
  gravados: number;
  linhas_total: number;
  linhas_ok: number;
  linhas_erro: number;
  fornecedores_afetados: number;
  documentos?: { CNPJ: number; CPF: number; INVALIDO: number };
  arquivo_modificado_em?: string | null;
};

/**
 * Lê o fornecedores.csv da pasta de ENTRADA e sincroniza produtos e custos.
 *
 * Se o arquivo não mudou desde a última importação bem-sucedida, não faz nada
 * (é o que torna a execução de hora em hora barata). `forcar` ignora essa
 * checagem.
 *
 * É idempotente: usa upsert por chave natural, então rodar de novo atualiza
 * em vez de duplicar.
 */
export async function executarImportacao(opts: {
  executadoPor?: string | null;
  automatica?: boolean;
  forcar?: boolean;
}): Promise<ResultadoImportacao> {
  const db = createAdminClient();

  const folderId = process.env.DRIVE_ENTRADA_FOLDER_ID!;
  const file = await findFileInFolder(folderId, ARQUIVO_ENTRADA);
  if (!file?.id) {
    throw new Error(`Arquivo ${ARQUIVO_ENTRADA} não encontrado na pasta de entrada`);
  }

  const checksum = file.md5Checksum ?? null;
  const modificadoEm = file.modifiedTime ?? null;

  // ---- o arquivo mudou desde a última importação bem-sucedida? ----
  if (!opts.forcar && checksum) {
    const { data: ultima } = await db
      .from("importacoes")
      .select("arquivo_checksum")
      .eq("resultado", "importado")
      .order("executado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultima?.arquivo_checksum === checksum) {
      await db.from("importacoes").insert({
        executado_por: opts.executadoPor ?? null,
        automatica: opts.automatica ?? false,
        resultado: "sem_alteracao",
        fonte: `drive:${ARQUIVO_ENTRADA}`,
        arquivo_checksum: checksum,
        arquivo_modificado_em: modificadoEm,
      });
      return {
        resultado: "sem_alteracao",
        gravados: 0,
        linhas_total: 0,
        linhas_ok: 0,
        linhas_erro: 0,
        fornecedores_afetados: 0,
        arquivo_modificado_em: modificadoEm,
      };
    }
  }

  // ---- importa ----
  const csv = await downloadFileText(file.id);
  const parsed = parseFornecedoresCsv(csv);

  const fornecedoresArr = Array.from(parsed.fornecedores.values());
  const documentos = { CNPJ: 0, CPF: 0, INVALIDO: 0 };
  for (const f of fornecedoresArr) documentos[f.documento_tipo]++;

  const codToId = new Map<string, string>();
  for (const lote of chunk(fornecedoresArr, 500)) {
    const { data, error } = await db
      .from("fornecedores")
      .upsert(lote, { onConflict: "codigo_fabricante" })
      .select("id, codigo_fabricante");
    if (error) throw new Error(`fornecedores: ${error.message}`);
    for (const f of data ?? []) codToId.set(f.codigo_fabricante as string, f.id);
  }

  const rows = parsed.produtos
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
  for (const lote of chunk(rows, LOTE)) {
    const { error } = await db
      .from("produtos")
      .upsert(lote, { onConflict: "fornecedor_id,codigo_fornecedor" });
    if (error) throw new Error(`produtos: ${error.message}`);
    gravados += lote.length;
  }

  await db.from("importacoes").insert({
    executado_por: opts.executadoPor ?? null,
    automatica: opts.automatica ?? false,
    resultado: "importado",
    fonte: `drive:${ARQUIVO_ENTRADA}`,
    arquivo_checksum: checksum,
    arquivo_modificado_em: modificadoEm,
    linhas_total: parsed.total,
    linhas_ok: rows.length,
    linhas_erro: parsed.erros.length,
    fornecedores_afetados: codToId.size,
    detalhe: { documentos, amostra_erros: parsed.erros.slice(0, 50) },
  });

  return {
    resultado: "importado",
    gravados,
    linhas_total: parsed.total,
    linhas_ok: rows.length,
    linhas_erro: parsed.erros.length,
    fornecedores_afetados: codToId.size,
    documentos,
    arquivo_modificado_em: modificadoEm,
  };
}
