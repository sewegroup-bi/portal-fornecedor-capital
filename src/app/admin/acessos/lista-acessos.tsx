"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Acesso = {
  fornecedor_id: string;
  codigo_fabricante: string | null;
  nome: string;
  email_cadastro: string | null;
  user_id: string | null;
  email_acesso: string | null;
  ativo: boolean | null;
  convidado_em: string | null;
  produtos: number;
};

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export default function ListaAcessos({ acessos }: { acessos: Acesso[] }) {
  const router = useRouter();
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; texto: string }>>({});

  async function convidar(a: Acesso) {
    const email = (emails[a.fornecedor_id] ?? a.email_cadastro ?? "").trim();
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
    if (data.ok) router.refresh();
  }

  async function alternarAcesso(a: Acesso) {
    if (!a.user_id) return;
    setOcupado(a.fornecedor_id);
    const r = await fetch("/api/admin/acessos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: a.user_id, ativo: !a.ativo }),
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
          <th style={{ width: 110 }}>Situação</th>
          <th style={{ width: 300 }}>Acesso</th>
        </tr>
      </thead>
      <tbody>
        {acessos.map((a) => {
          const temAcesso = !!a.user_id;
          const m = msg[a.fornecedor_id];
          return (
            <tr key={a.fornecedor_id}>
              <td className="muted">{a.codigo_fabricante}</td>
              <td>{a.nome}</td>
              <td style={{ textAlign: "right" }}>
                {a.produtos.toLocaleString("pt-BR")}
              </td>
              <td>
                {!temAcesso ? (
                  <span className="muted">sem acesso</span>
                ) : a.ativo ? (
                  <span className="badge">ativo</span>
                ) : (
                  <span className="badge warn">cortado</span>
                )}
              </td>
              <td>
                {temAcesso ? (
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {a.email_acesso} · convidado em {dataCurta(a.convidado_em)}
                    </div>
                    <button
                      className="secondary"
                      style={{ marginTop: 6 }}
                      onClick={() => alternarAcesso(a)}
                      disabled={ocupado === a.fornecedor_id}
                    >
                      {ocupado === a.fornecedor_id
                        ? "…"
                        : a.ativo
                          ? "Cortar acesso"
                          : "Reativar acesso"}
                    </button>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <input
                      type="email"
                      placeholder={a.email_cadastro ?? "e-mail do fornecedor"}
                      value={emails[a.fornecedor_id] ?? a.email_cadastro ?? ""}
                      onChange={(e) =>
                        setEmails((v) => ({ ...v, [a.fornecedor_id]: e.target.value }))
                      }
                    />
                    <button
                      onClick={() => convidar(a)}
                      disabled={ocupado === a.fornecedor_id}
                    >
                      {ocupado === a.fornecedor_id ? "…" : "Convidar"}
                    </button>
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
