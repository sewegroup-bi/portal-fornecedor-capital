import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ExportarPendencias from "./exportar";

const num = (n: number) => Number(n).toLocaleString("pt-BR");

export default async function DocumentosPage() {
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");

  if (!admin) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 80 }}>
        <div className="card">
          <h1>Acesso restrito</h1>
          <p className="muted">Esta área é exclusiva para administradores.</p>
          <Link href="/pedidos">← Voltar ao portal</Link>
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("fornecedores_documentos_pendentes")
    .select("*")
    .order("produtos", { ascending: false });

  const lista = data ?? [];

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Documentos a corrigir no ERP</h1>
          <p className="muted">
            Fornecedores cujo CNPJ/CPF chegou inválido ou vazio no arquivo de origem.
          </p>
        </div>
        <nav className="topo">
          <Link href="/admin">← Administração</Link>
        </nav>
      </div>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          O cadastro é mantido no <strong>ERP</strong> — este portal apenas espelha essa
          informação. Por isso a correção deve ser feita lá: assim que o cadastro for
          corrigido no ERP, o portal se atualiza sozinho na próxima hora.
        </p>
        <div className="between" style={{ marginTop: 16 }}>
          <span className="muted">
            <strong>{num(lista.length)}</strong> fornecedor(es) pendente(s)
          </span>
          <ExportarPendencias fornecedores={lista} />
        </div>
      </div>

      <div className="card">
        {lista.length === 0 ? (
          <p>✅ Nenhuma pendência — todos os fornecedores estão com CNPJ ou CPF válido.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Ordenado por quantidade de produtos — os mais relevantes primeiro.
            </p>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Código</th>
                  <th>Fornecedor</th>
                  <th style={{ width: 100, textAlign: "right" }}>Produtos</th>
                  <th style={{ width: 200 }}>Documento recebido</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id}>
                    <td className="muted">{f.codigo_fabricante}</td>
                    <td>{f.nome}</td>
                    <td style={{ textAlign: "right" }}>{num(f.produtos)}</td>
                    <td
                      className="muted"
                      style={{ fontFamily: "monospace", fontSize: 13 }}
                    >
                      {f.documento || "— vazio —"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
