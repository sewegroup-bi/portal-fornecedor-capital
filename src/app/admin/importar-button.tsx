"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Resultado = {
  ok?: boolean;
  erro?: string;
  gravados?: number;
  linhas_total?: number;
  linhas_ok?: number;
  linhas_erro?: number;
  fornecedores_afetados?: number;
  detalhe?: {
    documentos?: { CNPJ: number; CPF: number; INVALIDO: number };
  };
};

export default function ImportarButton() {
  const router = useRouter();
  const [carregando, setCarregando] = useState<null | "amostra" | "tudo">(null);
  const [res, setRes] = useState<Resultado | null>(null);

  async function importar(modo: "amostra" | "tudo") {
    setCarregando(modo);
    setRes(null);
    const url =
      modo === "amostra" ? "/api/admin/importar?limit=500" : "/api/admin/importar";
    try {
      const r = await fetch(url, { method: "POST" });
      const data = await r.json();
      setRes(data);
      if (data.ok) router.refresh();
    } catch (e) {
      setRes({ erro: e instanceof Error ? e.message : "Falha na requisição" });
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div>
      <div className="row">
        <button
          className="secondary"
          onClick={() => importar("amostra")}
          disabled={carregando !== null}
        >
          {carregando === "amostra" ? "Importando…" : "Importar amostra (500)"}
        </button>
        <button onClick={() => importar("tudo")} disabled={carregando !== null}>
          {carregando === "tudo" ? "Importando…" : "Importar tudo"}
        </button>
      </div>

      {res && (
        <div style={{ marginTop: 16 }}>
          {res.ok ? (
            <div>
              <p>
                ✅ Importado: <strong>{res.gravados}</strong> produtos ·{" "}
                {res.fornecedores_afetados} fornecedores · {res.linhas_erro} linha(s)
                com erro (de {res.linhas_total} no arquivo).
              </p>
              {res.detalhe?.documentos && (
                <p className="muted" style={{ fontSize: 13 }}>
                  Documentos dos fornecedores: {res.detalhe.documentos.CNPJ} CNPJ ·{" "}
                  {res.detalhe.documentos.CPF} CPF ·{" "}
                  <strong style={{ color: res.detalhe.documentos.INVALIDO > 0 ? "#ff8787" : undefined }}>
                    {res.detalhe.documentos.INVALIDO} a corrigir
                  </strong>
                </p>
              )}
            </div>
          ) : (
            <p className="error">❌ {res.erro}</p>
          )}
        </div>
      )}
    </div>
  );
}
