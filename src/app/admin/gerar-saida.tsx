"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Res = {
  ok?: boolean;
  erro?: string;
  linhas?: number;
  pedidos?: number;
  url?: string;
};

const num = (n: number) => Number(n).toLocaleString("pt-BR");

export default function GerarSaida() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Res | null>(null);

  async function gerar() {
    setCarregando(true);
    setRes(null);
    try {
      const r = await fetch("/api/admin/saida", { method: "POST" });
      const data = await r.json();
      setRes(data);
      if (data.ok) router.refresh();
    } catch (e) {
      setRes({ erro: e instanceof Error ? e.message : "Falha ao gerar" });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <a href="/api/admin/saida">
          <button className="secondary">Baixar planilha</button>
        </a>
        <button onClick={gerar} disabled={carregando}>
          {carregando ? "Gerando…" : "Gerar arquivo para o BI"}
        </button>
      </div>

      {res && (
        <p style={{ marginTop: 12 }} className={res.ok ? undefined : "error"}>
          {res.ok ? (
            <>
              ✅ Arquivo gerado com <strong>{num(res.pedidos ?? 0)}</strong> pedido(s) e{" "}
              <strong>{num(res.linhas ?? 0)}</strong> item(ns).{" "}
              {res.url && (
                <a href={res.url} target="_blank" rel="noopener noreferrer">
                  abrir arquivo
                </a>
              )}
            </>
          ) : (
            <>❌ {res.erro}</>
          )}
        </p>
      )}
    </div>
  );
}
