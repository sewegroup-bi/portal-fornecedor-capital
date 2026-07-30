import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ListaAcessos, { type Acesso } from "./lista-acessos";

const num = (n: number) => Number(n).toLocaleString("pt-BR");

export default async function AcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q, filtro } = await searchParams;
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

  let query = supabase.from("admin_acessos").select("*");
  if (q?.trim()) query = query.ilike("nome", `%${q.trim()}%`);
  if (filtro === "com") query = query.not("user_id", "is", null);
  if (filtro === "sem") query = query.is("user_id", null);

  const { data } = await query.order("produtos", { ascending: false }).limit(100);
  const lista = (data ?? []) as Acesso[];

  const comAcesso = lista.filter((a) => a.user_id).length;

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Acessos dos fornecedores</h1>
          <p className="muted">
            Convide por e-mail, corte ou reative o acesso ao portal.
          </p>
        </div>
        <nav className="topo">
          <Link href="/admin">← Administração</Link>
        </nav>
      </div>

      <div className="card">
        <form className="row" style={{ gap: 8 }}>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar fornecedor pelo nome…"
          />
          <select name="filtro" defaultValue={filtro ?? ""} style={{ width: 170 }}>
            <option value="">Todos</option>
            <option value="com">Com acesso</option>
            <option value="sem">Sem acesso</option>
          </select>
          <button type="submit">Filtrar</button>
        </form>
        <p className="muted" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          Mostrando {num(lista.length)} fornecedor(es) — {num(comAcesso)} com acesso.
          Ordenado por quantidade de produtos. O convite envia um e-mail para o
          fornecedor criar a própria senha.
        </p>
      </div>

      <div className="card">
        {lista.length === 0 ? (
          <p className="muted">Nenhum fornecedor encontrado.</p>
        ) : (
          <ListaAcessos acessos={lista} />
        )}
      </div>
    </div>
  );
}
