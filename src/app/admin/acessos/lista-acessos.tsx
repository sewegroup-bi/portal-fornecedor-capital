"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AcessoItem = {
  user_id: string;
  email: string | null;
  ativo: boolean;
  convidado_em: string | null;
};

export type Acesso = {
  fornecedor_id: string;
  codigo_fabricante: string | null;
  nome: string;
  email_cadastro: string | null;
  emails_cadastro: string[] | null;
  produtos: number;
  qtd_acessos: number;
  qtd_ativos: number;
  acessos: AcessoItem[];
};

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : null;

export default function ListaAcessos({ acessos }: { acessos: Acesso[] }) {
  const router = useRouter();
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; texto: string }>>({});

  function sugestoes(a: Acesso): string[] {
    const doErp = a.emails_cadastro ?? (a.email_cadastro ? [a.email_cadastro] : []);
    const jaUsados = a.acessos.map((x) => (x.email ?? "").toLowerCase());
    return doErp.filter((e) => e && !jaUsados.includes(e.toLowerCase()));
  }

  async function convidar(a: Acesso) {
    const email = (emails[a.fornecedor_id] ?? "").trim();
    if (!email) return;

    setOcupado(a.fornecedor_id);
    const r = await fetch("/api/admin/acessos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fornecedor_id: a.fornecedor_id, email }),
    });
    const data = await r.json();
    setOcupado(null);

    setMsg((m) => ({
      ...m,
      [a.fornecedor_id]: { ok: !!data.ok, texto: data.mensagem ?? data.erro },
    }));
    if (data.ok) {
      setEmails((v) => ({ ...v, [a.fornecedor_id]: "" }));
      router.refresh();
    }
  }

  async function alternarAcesso(a: Acesso, item: AcessoItem) {
    setOcupado(item.user_id);
    const r = await fetch("/api/admin/acessos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: item.user_id, ativo: !item.ativo }),
    });
    const data = await r.json();
    setOcupado(null);

    setMsg((m) => ({
      ...m,
      [a.fornecedor_id]: { ok: !!data.ok, texto: data.mensagem ?? data.erro },
    }));
    if (data.ok) router.refresh();
  }

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 70 }}>Código</th>
          <th>Fornecedor</th>
          <th style={{ width: 90, textAlign: "right" }}>Produtos</th>
          <th style={{ width: 420 }}>Acessos</th>
        </tr>
      </thead>
      <tbody>
        {acessos.map((a) => {
          const m = msg[a.fornecedor_id];
          const sug = sugestoes(a);
          return (
            <tr key={a.fornecedor_id}>
              <td className="muted">{a.codigo_fabricante}</td>
              <td>
                {a.nome}
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {a.qtd_acessos === 0
                    ? "sem acesso"
                    : `${a.qtd_ativos} de ${a.qtd_acessos} ativo(s)`}
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                {a.produtos.toLocaleString("pt-BR")}
              </td>
              <td>
                {/* logins já existentes */}
                {a.acessos.map((item) => (
                  <div
                    key={item.user_id}
                    className="between"
                    style={{ gap: 8, marginBottom: 6 }}
                  >
                    <span style={{ fontSize: 13 }}>
                      {item.ativo ? (
                        <span className="badge">ativo</span>
                      ) : (
                        <span className="badge warn">cortado</span>
                      )}{" "}
                      {item.email}
                      {dataCurta(item.convidado_em) && (
                        <span className="muted"> · {dataCurta(item.convidado_em)}</span>
                      )}
                    </span>
                    <button
                      className="secondary"
                      onClick={() => alternarAcesso(a, item)}
                      disabled={ocupado === item.user_id}
                    >
                      {ocupado === item.user_id
                        ? "…"
                        : item.ativo
                          ? "Cortar"
                          : "Reativar"}
                    </button>
                  </div>
                ))}

                {/* adicionar outro login (vários por fornecedor são permitidos) */}
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <input
                    type="email"
                    placeholder={
                      a.qtd_acessos === 0 ? "e-mail do fornecedor" : "adicionar outro e-mail"
                    }
                    value={emails[a.fornecedor_id] ?? ""}
                    onChange={(e) =>
                      setEmails((v) => ({ ...v, [a.fornecedor_id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") convidar(a);
                    }}
                  />
                  <button
                    onClick={() => convidar(a)}
                    disabled={
                      ocupado === a.fornecedor_id || !(emails[a.fornecedor_id] ?? "").trim()
                    }
                  >
                    {ocupado === a.fornecedor_id ? "…" : "Convidar"}
                  </button>
                </div>

                {/* sugestões vindas do cadastro do ERP */}
                {sug.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      do ERP:{" "}
                    </span>
                    {sug.map((e) => (
                      <button
                        key={e}
                        className="secondary sugestao"
                        onClick={() =>
                          setEmails((v) => ({ ...v, [a.fornecedor_id]: e }))
                        }
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                {m?.texto && (
                  <p
                    className={m.ok ? undefined : "error"}
                    style={{ fontSize: 13, margin: "6px 0 0" }}
                  >
                    {m.ok ? "✅ " : "❌ "}
                    {m.texto}
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
