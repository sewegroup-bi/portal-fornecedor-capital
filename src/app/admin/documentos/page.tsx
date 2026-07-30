import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ListaDocumentos from "./lista-documentos";

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

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Documentos a corrigir</h1>
          <p className="muted">
            Fornecedores cujo CNPJ/CPF veio inválido ou vazio do arquivo de origem.
          </p>
        </div>
        <nav className="topo">
          <Link href="/admin">← Administração</Link>
        </nav>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Digite o documento correto e salve. O sistema valida CNPJ/CPF (inclusive
          dígito verificador) e classifica automaticamente. Ordenado por quantidade de
          produtos — os mais relevantes primeiro.
        </p>
        <ListaDocumentos fornecedores={data ?? []} />
      </div>
    </div>
  );
}
