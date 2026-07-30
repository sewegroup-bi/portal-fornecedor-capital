"use client";

import { Fragment, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pedido = {
  id: string;
  data_registro: string;
  observacao: string | null;
  total: number;
  ciente_valores: boolean;
};

type Item = {
  quantidade: number;
  custo_unitario: number;
  subtotal: number;
  produtos: { codigo_fornecedor: string; nome: string } | null;
};

const brl = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function PedidosLista({ pedidos }: { pedidos: Pedido[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState<string | null>(null);
  const [itens, setItens] = useState<Record<string, Item[]>>({});
  const [carregando, setCarregando] = useState<string | null>(null);

  async function alternar(id: string) {
    if (aberto === id) {
      setAberto(null);
      return;
    }
    setAberto(id);
    if (itens[id]) return; // já carregado

    setCarregando(id);
    const { data } = await supabase
      .from("pedido_itens")
      .select("quantidade, custo_unitario, subtotal, produtos(codigo_fornecedor, nome)")
      .eq("pedido_id", id);
    setItens((prev) => ({ ...prev, [id]: (data ?? []) as unknown as Item[] }));
    setCarregando(null);
  }

  if (pedidos.length === 0) {
    return <p className="muted">Nenhum pedido registrado ainda.</p>;
  }

  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Clique em um pedido para ver os itens.
      </p>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Observação</th>
            <th>Ciência</th>
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <Fragment key={p.id}>
              <tr className="clicavel" onClick={() => alternar(p.id)}>
                <td>
                  {aberto === p.id ? "▾" : "▸"} {dataHora(p.data_registro)}
                </td>
                <td className="muted">{p.observacao || "—"}</td>
                <td>
                  {p.ciente_valores ? <span className="badge">ciente</span> : "—"}
                </td>
                <td style={{ textAlign: "right" }}>{brl(p.total)}</td>
              </tr>

              {aberto === p.id && (
                <tr className="detalhe">
                  <td colSpan={4}>
                    <div className="detalhe-box">
                      {carregando === p.id ? (
                        <span className="muted">Carregando itens…</span>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Produto</th>
                              <th style={{ textAlign: "right" }}>Qtde</th>
                              <th style={{ textAlign: "right" }}>Custo unit.</th>
                              <th style={{ textAlign: "right" }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(itens[p.id] ?? []).map((it, i) => (
                              <tr key={i}>
                                <td className="muted">
                                  {it.produtos?.codigo_fornecedor ?? "—"}
                                </td>
                                <td>{it.produtos?.nome ?? "—"}</td>
                                <td style={{ textAlign: "right" }}>{it.quantidade}</td>
                                <td style={{ textAlign: "right" }}>
                                  {brl(it.custo_unitario)}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {brl(it.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}
