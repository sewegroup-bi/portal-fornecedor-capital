import { parse } from "csv-parse/sync";

export type ProdutoImport = {
  cnpj: string; // digits-only, 14
  codigo_fornecedor: string; // = codigo_produto (ex.: 28906)
  codigo_produto_ref: string | null; // código embutido em "produto" (ex.: 0170076237)
  nome: string; // descrição após separar o código
  ean: string | null; // codigo_produto_fabricante
  custo: number;
  situacao: string | null;
};

export type FornecedorImport = {
  cnpj: string;
  nome: string;
  codigo_fabricante: string | null;
};

export type LinhaErro = { linha: number; motivo: string; dados: string };

export type ParseResult = {
  fornecedores: Map<string, FornecedorImport>; // key = cnpj
  produtos: ProdutoImport[];
  erros: LinhaErro[];
  total: number;
};

// "3,5" -> 3.5 ; "1.234,56" -> 1234.56
function parseCustoBR(v: string): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// só dígitos; válido se tiver 14
function normalizeCnpj(v: string): string {
  return String(v ?? "").replace(/\D/g, "");
}

// "0170076237 - CALCINHA PIETRA LISA M VERMELHO" -> ["0170076237", "CALCINHA ..."]
function splitProduto(v: string): { ref: string | null; nome: string } {
  const s = String(v ?? "").trim();
  const idx = s.indexOf(" - ");
  if (idx > 0) {
    return { ref: s.slice(0, idx).trim(), nome: s.slice(idx + 3).trim() };
  }
  return { ref: null, nome: s };
}

export function parseFornecedoresCsv(csv: string): ParseResult {
  const records: Record<string, string>[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true,
  });

  const fornecedores = new Map<string, FornecedorImport>();
  const produtos: ProdutoImport[] = [];
  const erros: LinhaErro[] = [];

  records.forEach((r, i) => {
    const linha = i + 2; // +1 header, +1 base-1
    const cnpj = normalizeCnpj(r["cgc_fabricante"]);
    const codigo = String(r["codigo_produto"] ?? "").trim();
    const custo = parseCustoBR(r["custo"]);

    const resumo = `${r["cgc_fabricante"] ?? ""} | ${r["produto"] ?? ""} | ${r["custo"] ?? ""}`;

    if (cnpj.length !== 14) {
      erros.push({ linha, motivo: "CNPJ inválido", dados: resumo });
      return;
    }
    if (!codigo) {
      erros.push({ linha, motivo: "codigo_produto vazio", dados: resumo });
      return;
    }
    if (custo == null || custo < 0) {
      erros.push({ linha, motivo: "custo inválido", dados: resumo });
      return;
    }

    if (!fornecedores.has(cnpj)) {
      fornecedores.set(cnpj, {
        cnpj,
        nome: String(r["nome_fabricante"] ?? "").trim() || cnpj,
        codigo_fabricante: String(r["codigo_fabricante"] ?? "").trim() || null,
      });
    }

    const { ref, nome } = splitProduto(r["produto"]);
    produtos.push({
      cnpj,
      codigo_fornecedor: codigo,
      codigo_produto_ref: ref,
      nome,
      ean: String(r["codigo_produto_fabricante"] ?? "").trim() || null,
      custo,
      situacao: String(r["situacao"] ?? "").trim() || null,
    });
  });

  return { fornecedores, produtos, erros, total: records.length };
}
