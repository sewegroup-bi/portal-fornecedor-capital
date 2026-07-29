import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import ImportarButton from "./importar-button";
import GerarSaidaDrive from "./gerar-saida-drive";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminPage() {
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

  const [
    { count: totalProdutos },
    { count: totalFornecedores },
    { count: totalPedidos },
    { data: imports },
  ] = await Promise.all([
    supabase.from("produtos").select("*", { count: "exact", head: true }),
    supabase.from("fornecedores").select("*", { count: "exact", head: true }),
    supabase.from("pedidos").select("*", { count: "exact", head: true }),
    supabase
      .from("importacoes")
      .select("executado_em, fonte, linhas_ok, linhas_erro, fornecedores_afetados")
      .order("executado_em", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Administração</h1>
          <p className="muted">Portal do Fornecedor — Capital da Lingerie</p>
        </div>
        <form action={logout}>
          <button className="secondary" type="submit">
            Sair
          </button>
        </form>
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Importar produtos e custos (Google Drive)</h1>
        <p className="muted">
          Lê o arquivo <code>fornecedores.csv</code> da pasta ENTRADA DE DADOS e atualiza
          os custos. O custo importado fica travado — fornecedores não editam.
        </p>
        <div className="between" style={{ margin: "12px 0" }}>
          <span className="muted">Base atual</span>
          <span>
            <strong>{totalProdutos ?? 0}</strong> produtos ·{" "}
            <strong>{totalFornecedores ?? 0}</strong> fornecedores
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Dica: rode primeiro <em>Importar amostra (500)</em> para validar, depois{" "}
          <em>Importar tudo</em>.
        </p>
        <ImportarButton />
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Saída de dados (BI)</h1>
        <p className="muted">
          Dataset pronto para o BI (grão de item de pedido). Baixe em CSV ou conecte
          o Qlik direto na view <code>saida_pedidos</code>.
        </p>
        <div className="between" style={{ margin: "12px 0" }}>
          <span className="muted">Pedidos registrados</span>
          <span>
            <strong>{totalPedidos ?? 0}</strong>
          </span>
        </div>
        <GerarSaidaDrive />
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Histórico de importações</h1>
        {imports && imports.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Fonte</th>
                <th style={{ textAlign: "right" }}>OK</th>
                <th style={{ textAlign: "right" }}>Erros</th>
                <th style={{ textAlign: "right" }}>Fornecedores</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp, i) => (
                <tr key={i}>
                  <td>{dataHora(imp.executado_em)}</td>
                  <td className="muted">{imp.fonte}</td>
                  <td style={{ textAlign: "right" }}>{imp.linhas_ok}</td>
                  <td style={{ textAlign: "right" }}>{imp.linhas_erro}</td>
                  <td style={{ textAlign: "right" }}>{imp.fornecedores_afetados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhuma importação ainda.</p>
        )}
      </div>
    </div>
  );
}
