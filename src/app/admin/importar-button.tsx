"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Docs = { CNPJ: number; CPF: number; INVALIDO: number };

type Resposta = {
  ok?: boolean;
  erro?: string;
  gravados?: number;
  total_validos?: number;
  linhas_total?: number;
  linhas_erro?: number;
  fornecedores_afetados?: number;
  detalhe?: { documentos?: Docs };
};

type Resultado = {
  ok: boolean;
  erro?: string;
  gravados: number;
  linhas_total?: number;
  linhas_erro?: number;
  fornecedores_afetados?: number;
  documentos?: Docs;
};

const PAGE = 8000;

export default function ImportarButton() {
  const router = useRouter();
  const [carregando, setCarregando] = useState<null | "amostra" | "tudo">(null);
  const [progresso, setProgresso] = useState<string>("");
  const [res, setRes] = useState<Resultado | null>(null);

  async function chamar(limit: number, offset: number): Promise<Resposta> {
    const r = await fetch(`/api/admin/importar?limit=${limit}&offset=${offset}`, {
      method: "POST",
    });
    return r.json();
  }

  async function importarAmostra() {
    setCarregando("amostra");
    setRes(null);
    setProgresso("");
    try {
      const d = await chamar(500, 0);
      setRes(
        d.ok
          ? {
              ok: true,
              gravados: d.gravados ?? 0,
              linhas_total: d.linhas_total,
              linhas_erro: d.linhas_erro,
              fornecedores_afetados: d.fornecedores_afetados,
              documentos: d.detalhe?.documentos,
            }
          : { ok: false, erro: d.erro, gravados: 0 }
      );
      if (d.ok) router.refresh();
    } finally {
      setCarregando(null);
    }
  }

  async function importarTudo() {
    setCarregando("tudo");
    setRes(null);
    let offset = 0;
    let total = Infinity;
    let gravados = 0;
    let ultimo: Resposta | null = null;
    try {
      while (offset < total) {
        setProgresso(
          `Importando… ${gravados}${total !== Infinity ? "/" + total : ""} produtos`
        );
        const d = await chamar(PAGE, offset);
        if (!d.ok) {
          setRes({ ok: false, erro: d.erro, gravados });
          return;
        }
        ultimo = d;
        total = d.total_validos ?? gravados + (d.gravados ?? 0);
        gravados += d.gravados ?? 0;
        offset += PAGE;
      }
      setProgresso("");
      setRes({
        ok: true,
        gravados,
        linhas_total: ultimo?.linhas_total,
        linhas_erro: ultimo?.linhas_erro,
        fornecedores_afetados: ultimo?.fornecedores_afetados,
        documentos: ultimo?.detalhe?.documentos,
      });
      router.refresh();
    } catch (e) {
      setRes({ ok: false, erro: e instanceof Error ? e.message : "Falha", gravados });
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div>
      <div className="row">
        <button className="secondary" onClick={importarAmostra} disabled={carregando !== null}>
          {carregando === "amostra" ? "Importando…" : "Importar amostra (500)"}
        </button>
        <button onClick={importarTudo} disabled={carregando !== null}>
          {carregando === "tudo" ? "Importando…" : "Importar tudo"}
        </button>
      </div>

      {carregando === "tudo" && progresso && (
        <p className="muted" style={{ marginTop: 12 }}>
          ⏳ {progresso} — não feche esta aba.
        </p>
      )}

      {res && (
        <div style={{ marginTop: 16 }}>
          {res.ok ? (
            <div>
              <p>
                ✅ Importado: <strong>{res.gravados}</strong> produtos ·{" "}
                {res.fornecedores_afetados} fornecedores · {res.linhas_erro} linha(s)
                com erro (de {res.linhas_total} no arquivo).
              </p>
              {res.documentos && (
                <p className="muted" style={{ fontSize: 13 }}>
                  Documentos: {res.documentos.CNPJ} CNPJ · {res.documentos.CPF} CPF ·{" "}
                  <strong
                    style={{ color: res.documentos.INVALIDO > 0 ? "#ff8787" : undefined }}
                  >
                    {res.documentos.INVALIDO} a corrigir
                  </strong>
                </p>
              )}
            </div>
          ) : (
            <p className="error">
              ❌ {res.erro}
              {res.gravados > 0 && ` (parcial: ${res.gravados} gravados antes de falhar)`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
