import { parse } from "csv-parse/sync";

export type DocumentoTipo = "CNPJ" | "CPF" | "INVALIDO";

export type ProdutoImport = {
  codigo_fabricante: string; // chave do fornecedor
  codigo_fornecedor: string; // = codigo_produto (ex.: 28906)
  codigo_produto_ref: string | null; // código embutido em "produto" (ex.: 0170076237)
  nome: string; // descrição após separar o código
  ean: string | null; // codigo_produto_fabricante
  custo: number;
  situacao: string | null;
};

export type FornecedorImport = {
  codigo_fabricante: string;
  nome: string;
  documento: string | null; // valor cru do cgc_fabricante
  documento_tipo: DocumentoTipo;
  cnpj: string | null; // dígitos, só quando documento_tipo = CNPJ (compatibilidade/exibição)
  email: string | null; // primeiro e-mail encontrado (compatibilidade/exibição)
  emails: string[]; // todos os e-mails de contato vindos do ERP
};

export type LinhaErro = { linha: number; motivo: string; dados: string };

export type ParseResult = {
  fornecedores: Map<string, FornecedorImport>; // key = codigo_fabricante
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

function onlyDigits(v: string): string {
  return String(v ?? "").replace(/\D/g, "");
}

function classificarDocumento(cgc: string): { tipo: DocumentoTipo; cnpj: string | null } {
  const d = onlyDigits(cgc);
  if (d.length === 14) return { tipo: "CNPJ", cnpj: d };
  if (d.length === 11) return { tipo: "CPF", cnpj: null };
  return { tipo: "INVALIDO", cnpj: null };
}

// O ERP ainda não exporta e-mail; quando exportar, aceita os nomes de coluna
// mais prováveis sem precisar mexer no código.
const COLUNAS_EMAIL = [
  "email",
  "e_mail",
  "email_fabricante",
  "email_fornecedor",
  "e_mail_fabricante",
];

// Uma célula pode trazer mais de um e-mail (separados por ; , ou espaço).
function extrairEmails(r: Record<string, string>): string[] {
  const encontrados: string[] = [];
  for (const c of COLUNAS_EMAIL) {
    const v = String(r[c] ?? "").trim();
    if (!v) continue;
    for (const parte of v.split(/[;,\s]+/)) {
      const e = parte.trim().toLowerCase();
      if (e.includes("@") && !encontrados.includes(e)) encontrados.push(e);
    }
  }
  return encontrados;
}

// "0170076237 - CALCINHA PIETRA LISA M VERMELHO" -> { ref: "0170076237", nome: "CALCINHA ..." }
function splitProduto(v: string): { ref: string | null; nome: string } {
  const s = String(v ?? "").trim();
  const idx = s.indexOf(" - ");
  if (idx > 0) return { ref: s.slice(0, idx).trim(), nome: s.slice(idx + 3).trim() };
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
    const codigoFab = String(r["codigo_fabricante"] ?? "").trim();
    const codigoProd = String(r["codigo_produto"] ?? "").trim();
    const custo = parseCustoBR(r["custo"]);

    const resumo = `fab:${r["codigo_fabricante"] ?? ""} | ${r["produto"] ?? ""} | ${r["custo"] ?? ""}`;

    // agora só bloqueia o que realmente inviabiliza o produto (não o CNPJ)
    if (!codigoFab) {
      erros.push({ linha, motivo: "codigo_fabricante vazio", dados: resumo });
      return;
    }
    if (!codigoProd) {
      erros.push({ linha, motivo: "codigo_produto vazio", dados: resumo });
      return;
    }
    if (custo == null || custo < 0) {
      erros.push({ linha, motivo: "custo inválido", dados: resumo });
      return;
    }

    if (!fornecedores.has(codigoFab)) {
      const cgc = String(r["cgc_fabricante"] ?? "");
      const { tipo, cnpj } = classificarDocumento(cgc);
      fornecedores.set(codigoFab, {
        codigo_fabricante: codigoFab,
        nome: String(r["nome_fabricante"] ?? "").trim() || codigoFab,
        documento: cgc.trim() || null,
        documento_tipo: tipo,
        cnpj,
        email: null,
        emails: [],
      });
    }

    // o mesmo fornecedor aparece em muitas linhas: acumula os e-mails distintos
    const f = fornecedores.get(codigoFab)!;
    for (const e of extrairEmails(r)) {
      if (!f.emails.includes(e)) f.emails.push(e);
    }
    if (!f.email && f.emails.length > 0) f.email = f.emails[0];

    const { ref, nome } = splitProduto(r["produto"]);
    produtos.push({
      codigo_fabricante: codigoFab,
      codigo_fornecedor: codigoProd,
      codigo_produto_ref: ref,
      nome,
      ean: String(r["codigo_produto_fabricante"] ?? "").trim() || null,
      custo,
      situacao: String(r["situacao"] ?? "").trim() || null,
    });
  });

  return { fornecedores, produtos, erros, total: records.length };
}
