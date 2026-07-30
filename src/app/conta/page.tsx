import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import AlterarSenha from "./alterar-senha";

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: admin }, { data: fornecedor }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.from("fornecedores").select("nome, documento").maybeSingle(),
  ]);

  return (
    <div className="container" style={{ maxWidth: 620 }}>
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Minha conta</h1>
          <p className="muted">Portal do Fornecedor — Capital da Lingerie</p>
        </div>
        <nav className="topo">
          <Link href="/pedidos">Pedidos</Link>
          {admin && <Link href="/admin">Administração</Link>}
          <form action={logout}>
            <button className="secondary" type="submit">
              Sair
            </button>
          </form>
        </nav>
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Dados de acesso</h1>
        <div className="between" style={{ marginTop: 12 }}>
          <span className="muted">E-mail</span>
          <span>{user?.email}</span>
        </div>
        <div className="between" style={{ marginTop: 8 }}>
          <span className="muted">Perfil</span>
          <span>{admin ? "Administrador" : "Fornecedor"}</span>
        </div>
        {fornecedor && (
          <div className="between" style={{ marginTop: 8 }}>
            <span className="muted">Fornecedor</span>
            <span>
              {fornecedor.nome}
              {fornecedor.documento ? ` — ${fornecedor.documento}` : ""}
            </span>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Para alterar o e-mail, fale com a Capital/Sewe.
        </p>
      </div>

      <div className="card">
        <h1 style={{ fontSize: 18 }}>Alterar senha</h1>
        <AlterarSenha />
      </div>
    </div>
  );
}
