"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Primeira senha do fornecedor, após clicar no link do convite.
export default function DefinirSenhaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    router.push("/pedidos");
    router.refresh();
  }

  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="card">
        <h1>Definir senha</h1>
        <p className="muted">
          Bem-vindo ao Portal do Fornecedor da Capital da Lingerie. Crie uma senha para
          acessar.
        </p>

        <form onSubmit={salvar}>
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
          />

          <label htmlFor="confirma">Confirmar senha</label>
          <input
            id="confirma"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            autoComplete="new-password"
          />

          {erro && <p className="error">{erro}</p>}

          <button type="submit" disabled={salvando} style={{ width: "100%", marginTop: 20 }}>
            {salvando ? "Salvando…" : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
