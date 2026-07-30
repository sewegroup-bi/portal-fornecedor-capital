"use client";

type Fornecedor = {
  codigo_fabricante: string | null;
  nome: string;
  documento: string | null;
  produtos: number;
};

function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Gera a lista para enviar a quem mantém o cadastro no ERP.
export default function ExportarPendencias({
  fornecedores,
}: {
  fornecedores: Fornecedor[];
}) {
  function baixar() {
    const colunas = ["codigo_fabricante", "nome", "documento_atual", "produtos"];
    const linhas = fornecedores.map((f) =>
      [f.codigo_fabricante, f.nome, f.documento, f.produtos].map(csvCell).join(",")
    );
    const csv = "﻿" + [colunas.join(","), ...linhas].join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "documentos_a_corrigir_no_erp.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={baixar} disabled={fornecedores.length === 0}>
      Baixar lista (CSV)
    </button>
  );
}
