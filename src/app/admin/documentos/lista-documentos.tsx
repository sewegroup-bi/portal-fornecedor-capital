"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Fornecedor = {
  id: string;
  codigo_fabricante: string | null;
  nome: string;
  documento: string | null;
  produtos: number;
};

export default function ListaDocumentos({
  fornecedores,
}: {
  fornecedores: Fornecedor[];
}) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; texto: string }>>({});

  async function salvar(f: Fornecedor) {
    const documento = (valores[f.id] ?? "").trim();
    if (!documento) return;

    setSalvando(f.id);
    setMsg((m) => ({ ...m, [f.id]: { ok: false, texto: "" } }));

    const r = await fetch("/api/admin/documento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fornecedor_id: f.id, documento }),
    });
    const data = await r.json();
    setSalvando(null);

    if (data.ok) {
      setMsg((m) => ({
        ...m,
        [f.id]: { ok: true, texto: `Salvo como ${data.tipo}: ${data.documento}` },
      }));
      router.refresh();
    } else {
      setMsg((m) => ({ ...m, [f.id]: { ok: false, texto: data.erro } }));
    }
  }

  if (fornecedores.length === 0) {
    return (
      <p>
        ✅ Nenhum documento pendente — todos os fornecedores estão com CNPJ ou CPF
        válido.
      </p>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 70 }}>Código</th>
          <th>Fornecedor</th>
          <th style={{ width: 90, textAlign: "right" }}>Produtos</th>
          <th style={{ width: 170 }}>Documento atual</th>
          <th style={{ width: 260 }}>Corrigir para</th>
        </tr>
      </thead>
      <tbody>
        {fornecedores.map((f) => (
          <tr key={f.id}>
            <td className="muted">{f.codigo_fabricante}</td>
            <td>{f.nome}</td>
            <td style={{ textAlign: "right" }}>{f.produtos}</td>
            <td className="muted" style={{ fontFamily: "monospace", fontSize: 13 }}>
              {f.documento || "— vazio —"}
            </td>
            <td>
              <div className="row" style={{ gap: 6 }}>
                <input
                  type="text"
                  placeholder="CNPJ ou CPF"
                  value={valores[f.id] ?? ""}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [f.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvar(f);
                  }}
                />
                <button
                  onClick={() => salvar(f)}
                  disabled={salvando === f.id || !(valores[f.id] ?? "").trim()}
                >
                  {salvando === f.id ? "…" : "Salvar"}
                </button>
              </div>
              {msg[f.id]?.texto && (
                <p
                  className={msg[f.id].ok ? undefined : "error"}
                  style={{ fontSize: 13, margin: "6px 0 0" }}
                >
                  {msg[f.id].ok ? "✅ " : "❌ "}
                  {msg[f.id].texto}
                </p>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
