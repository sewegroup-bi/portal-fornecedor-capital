import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import NovoPedidoForm from "./novo-pedido-form";

const brl = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function PedidosPage() {
  const supabase = await createClient();

  // RLS garante que cada consulta já vem filtrada pelo fornecedor logado.
  const [{ data: fornecedor }, { data: produtos }, { data: pedidos }] =
    await Promise.all([
      supabase.from("fornecedores").select("nome, cnpj").maybeSingle(),
      supabase
        .from("produtos")
        .select("id, codigo_fornecedor, nome, custo")
        .order("codigo_fornecedor"),
      supabase
        .from("pedidos")
        .select("id, data_registro, observacao, total, ciente_valores")
        .order("data_registro", { ascending: false }),
    ]);

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Portal do Fornecedor</h1>
          <p className="muted">
            {fornecedor
              ? `${fornecedor.nome} — ${fornecedor.cnpj}`
              : "Fornecedor não vinculado a este usuário"}
          </p>
        </div>
        <form action={logout}>
          <button className="secondary" type="submit">
            Sair
          </button>
        </form>
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Novo pedido</h1>
        <p className="muted">
          Selecione os produtos e as quantidades. O custo é definido pela Capital
          e não pode ser alterado aqui.
        </p>
        <NovoPedidoForm produtos={produtos ?? []} />
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Pedidos registrados</h1>
        {pedidos && pedidos.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Observação</th>
                <th>Ciência</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>{dataHora(p.data_registro)}</td>
                  <td className="muted">{p.observacao || "—"}</td>
                  <td>{p.ciente_valores ? <span className="badge">ciente</span> : "—"}</td>
                  <td style={{ textAlign: "right" }}>{brl(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhum pedido registrado ainda.</p>
        )}
      </div>
    </div>
  );
}
