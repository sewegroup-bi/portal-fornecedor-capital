import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import NovoPedidoForm from "./novo-pedido-form";
import PedidosExpansivel from "@/components/pedidos-expansivel";

export default async function PedidosPage() {
  const supabase = await createClient();

  // RLS garante que cada consulta já vem filtrada pelo fornecedor logado.
  const [{ data: fornecedor }, { data: pedidos }, { data: admin }] = await Promise.all([
    supabase.from("fornecedores").select("nome, cnpj, documento").maybeSingle(),
    supabase
      .from("pedidos")
      .select("id, data_registro, observacao, total, ciente_valores")
      .order("data_registro", { ascending: false }),
    supabase.rpc("is_admin"),
  ]);

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Portal do Fornecedor</h1>
          <p className="muted">
            {fornecedor
              ? `${fornecedor.nome} — ${fornecedor.documento ?? fornecedor.cnpj ?? "sem documento"}`
              : "Fornecedor não vinculado a este usuário"}
          </p>
        </div>
        <nav className="topo">
          <Link href="/conta">Minha conta</Link>
          {admin && <Link href="/admin">Administração</Link>}
          <form action={logout}>
            <button className="secondary" type="submit">
              Sair
            </button>
          </form>
        </nav>
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Novo pedido</h1>
        <p className="muted">
          Selecione os produtos e as quantidades. O custo é definido pela Capital
          e não pode ser alterado aqui.
        </p>
        <NovoPedidoForm />
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Pedidos registrados</h1>
        <PedidosExpansivel pedidos={pedidos ?? []} />
      </div>
    </div>
  );
}
