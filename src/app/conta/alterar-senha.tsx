"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AlterarSenha() {
  const supabase = useMemo(() => createClient(), []);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (senha.length < 8) {
      setMsg({ ok: false, texto: "A senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (senha !== confirma) {
      setMsg({ ok: false, texto: "As senhas não conferem." });
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setMsg({ ok: false, texto: error.message });
      return;
    }
    setSenha("");
    setConfirma("");
    setMsg({ ok: true, texto: "Senha alterada com sucesso." });
  }

  return (
    <form onSubmit={salvar}>
      <label htmlFor="senha">Nova senha</label>
      <input
        id="senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="new-password"
        placeholder="mínimo 8 caracteres"
      />

      <label htmlFor="confirma">Confirmar nova senha</label>
      <input
        id="confirma"
        type="password"
        value={confirma}
        onChange={(e) => setConfirma(e.target.value)}
        autoComplete="new-password"
      />

      {msg && (
        <p className={msg.ok ? undefined : "error"} style={{ marginTop: 10 }}>
          {msg.ok ? "✅ " : "❌ "}
          {msg.texto}
        </p>
      )}

      <button type="submit" disabled={salvando} style={{ marginTop: 16 }}>
        {salvando ? "Salvando…" : "Alterar senha"}
      </button>
    </form>
  );
}
