"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Resultado = {
  ok?: boolean;
  erro?: string;
  gravados?: number;
  fornecedores_afetados?: number;
  linhas_erro?: number;
  detalhe?: { documentos?: { CNPJ: number; CPF: number; INVALIDO: number } };
};

const num = (n: number) => Number(n).toLocaleString("pt-BR");

export default function ImportarButton() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function atualizar() {
    setCarregando(true);
    setRes(null);
    try {
      const r = await fetch("/api/admin/importar", { method: "POST" });
      const data = await r.json();
      setRes(data);
      if (data.ok) router.refresh();
    } catch (e) {
      setRes({ erro: e instanceof Error ? e.message : "Falha na atualização" });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <button onClick={atualizar} disabled={carregando}>
        {carregando ? "Atualizando…" : "Atualizar agora"}
      </button>

      {carregando && (
        <p className="muted" style={{ marginTop: 10 }}>
          ⏳ Buscando as informações mais recentes — isso pode levar alguns minutos.
          Não feche esta aba.
        </p>
      )}

      {res && !carregando && (
        <div style={{ marginTop: 14 }}>
          {res.ok ? (
            <p>
              ✅ Catálogo atualizado: <strong>{num(res.gravados ?? 0)}</strong> produtos
              de <strong>{num(res.fornecedores_afetados ?? 0)}</strong> fornecedores.
            </p>
          ) : (
            <p className="error">❌ {res.erro}</p>
          )}
        </div>
      )}
    </div>
  );
}
