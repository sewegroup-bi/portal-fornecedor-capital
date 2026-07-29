"use client";

import { useState } from "react";

type Res = { ok?: boolean; erro?: string; arquivo?: string; link?: string };

export default function GerarSaidaDrive() {
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Res | null>(null);

  async function gerar() {
    setCarregando(true);
    setRes(null);
    try {
      const r = await fetch("/api/admin/saida", { method: "POST" });
      setRes(await r.json());
    } catch (e) {
      setRes({ erro: e instanceof Error ? e.message : "Falha" });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <a href="/api/admin/saida">
          <button className="secondary">Baixar saída (CSV)</button>
        </a>
        <button onClick={gerar} disabled={carregando}>
          {carregando ? "Gerando…" : "Gerar na pasta SAÍDA do Drive"}
        </button>
      </div>
      {res && (
        <p style={{ marginTop: 12 }} className={res.ok ? undefined : "error"}>
          {res.ok ? (
            <>
              ✅ Arquivo <strong>{res.arquivo}</strong> gravado na pasta SAÍDA.{" "}
              {res.link && (
                <a href={res.link} target="_blank" rel="noopener noreferrer">
                  abrir no Drive
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
