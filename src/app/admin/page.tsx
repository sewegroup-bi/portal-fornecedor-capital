import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import ImportarButton from "./importar-button";
import GerarSaida from "./gerar-saida";
import PedidosExpansivel from "@/components/pedidos-expansivel";

const brl = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// valores altos viram "R$ 1,2 mi" para não estourar o painel (o valor cheio fica no title)
const brlPainel = (n: number) => {
  const v = Number(n);
  if (v >= 1_000_000)
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  return brl(v);
};

const num = (n: number) => Number(n).toLocaleString("pt-BR");

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

  const [{ data: resumo }, { data: ultimosPedidos }, { data: imports }] =
    await Promise.all([
      supabase.from("admin_resumo").select("*").maybeSingle(),
      supabase
        .from("admin_pedidos")
        .select("*")
        .order("data_registro", { ascending: false })
        .limit(10),
      supabase
        .from("importacoes")
        .select(
          "executado_em, automatica, resultado, linhas_ok, linhas_erro, fornecedores_afetados"
        )
        .order("executado_em", { ascending: false })
        .limit(8),
    ]);

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Administração</h1>
          <p className="muted">Portal do Fornecedor — Capital da Lingerie</p>
        </div>
        <nav className="topo">
          <Link href="/pedidos">Portal</Link>
          <Link href="/conta">Minha conta</Link>
          <form action={logout}>
            <button className="secondary" type="submit">
              Sair
            </button>
          </form>
        </nav>
      </div>

      {/* ---------- visão geral ---------- */}
      <div className="card">
        <h1 style={{ fontSize: 18 }}>Visão geral</h1>
        <div className="stats" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="valor">{num(resumo?.total_pedidos ?? 0)}</div>
            <div className="rotulo">pedidos no total</div>
          </div>
          <div className="stat">
            <div className="valor">{num(resumo?.pedidos_7d ?? 0)}</div>
            <div className="rotulo">nos últimos 7 dias</div>
          </div>
          <div className="stat">
            <div className="valor" title={brl(resumo?.valor_total ?? 0)}>
              {brlPainel(resumo?.valor_total ?? 0)}
            </div>
            <div className="rotulo">valor total pedido</div>
          </div>
          <div className="stat">
            <div className="valor">{num(resumo?.total_produtos ?? 0)}</div>
            <div className="rotulo">produtos na base</div>
          </div>
          <div className="stat">
            <div className="valor">{num(resumo?.total_fornecedores ?? 0)}</div>
            <div className="rotulo">fornecedores</div>
          </div>
          <div className="stat">
            <Link href="/admin/acessos">
              <div className="valor">{num(resumo?.acessos_ativos ?? 0)}</div>
              <div className="rotulo">acessos liberados →</div>
            </Link>
          </div>
          <div className="stat">
            <Link href="/admin/documentos">
              <div className="valor" style={{ color: "#ff8787" }}>
                {num(resumo?.documentos_a_corrigir ?? 0)}
              </div>
              <div className="rotulo">documentos a corrigir →</div>
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- últimos pedidos ---------- */}
      <div className="card">
        <h1 style={{ fontSize: 18 }}>Últimos pedidos</h1>
        <PedidosExpansivel pedidos={ultimosPedidos ?? []} mostrarFornecedor />
      </div>

      {/* ---------- entrada ---------- */}
      <div className="card">
        <h1 style={{ fontSize: 18 }}>Importar produtos e custos (Google Drive)</h1>
        <p className="muted">
          A importação roda <strong>automaticamente de hora em hora</strong>, lendo o{" "}
          <code>fornecedores.csv</code> da pasta ENTRADA DE DADOS. Quando o arquivo não
          mudou, a execução é ignorada. O cadastro é mantido no ERP — o portal apenas
          espelha.
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Os botões abaixo servem para forçar uma atualização imediata, sem esperar o
          próximo ciclo.
        </p>
        <ImportarButton />
      </div>

      {/* ---------- saída ---------- */}
      <div className="card">
        <h1 style={{ fontSize: 18 }}>Saída de dados (BI)</h1>
        <p className="muted">
          Dataset pronto para o BI (grão de item de pedido). Baixe em CSV, gere o
          arquivo no Storage (para o Full Screen/BI puxar depois) ou conecte o Qlik
          direto na view <code>saida_pedidos</code>.
        </p>
        <GerarSaida />
      </div>

      {/* ---------- histórico ---------- */}
      <div className="card">
        <h1 style={{ fontSize: 18 }}>Histórico de importações</h1>
        {imports && imports.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Origem</th>
                <th>Resultado</th>
                <th style={{ textAlign: "right" }}>OK</th>
                <th style={{ textAlign: "right" }}>Erros</th>
                <th style={{ textAlign: "right" }}>Fornecedores</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp, i) => (
                <tr key={i}>
                  <td>{dataHora(imp.executado_em)}</td>
                  <td className="muted">{imp.automatica ? "automática" : "manual"}</td>
                  <td>
                    {imp.resultado === "erro" ? (
                      <span className="badge warn">erro</span>
                    ) : imp.resultado === "sem_alteracao" ? (
                      <span className="muted">sem alteração</span>
                    ) : (
                      <span className="badge">importado</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>{num(imp.linhas_ok ?? 0)}</td>
                  <td style={{ textAlign: "right" }}>{num(imp.linhas_erro ?? 0)}</td>
                  <td style={{ textAlign: "right" }}>
                    {num(imp.fornecedores_afetados ?? 0)}
                  </td>
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
