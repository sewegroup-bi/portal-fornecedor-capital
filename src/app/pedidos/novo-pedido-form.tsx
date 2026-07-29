"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarPedido } from "./actions";

type Produto = {
  id: string;
  codigo_fornecedor: string;
  nome: string;
  custo: number;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function NovoPedidoForm({ produtos }: { produtos: Produto[] }) {
  const router = useRouter();
  // quantidades por produto_id
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [observacao, setObservacao] = useState("");
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const itens = useMemo(
    () =>
      produtos
        .map((p) => ({ produto: p, quantidade: qtd[p.id] ?? 0 }))
        .filter((i) => i.quantidade > 0),
    [produtos, qtd]
  );

  const total = useMemo(
    () => itens.reduce((s, i) => s + i.produto.custo * i.quantidade, 0),
    [itens]
  );

  const podeEnviar = itens.length > 0 && ciente && !salvando;

  async function enviar() {
    setErro(null);
    setSalvando(true);
    const res = await criarPedido({
      itens: itens.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
      })),
      observacao,
      ciente,
    });
    setSalvando(false);

    if (!res.ok) {
      setErro(res.erro ?? "Erro ao registrar o pedido");
      return;
    }
    setQtd({});
    setObservacao("");
    setCiente(false);
    router.refresh();
  }

  if (produtos.length === 0) {
    return (
      <p className="muted">
        Nenhum produto disponível para o seu fornecedor ainda.
      </p>
    );
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Produto</th>
            <th>Custo unit.</th>
            <th style={{ width: 110 }}>Quantidade</th>
            <th style={{ textAlign: "right" }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((p) => {
            const q = qtd[p.id] ?? 0;
            return (
              <tr key={p.id}>
                <td className="muted">{p.codigo_fornecedor}</td>
                <td>{p.nome}</td>
                <td>{brl(p.custo)}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={q === 0 ? "" : q}
                    placeholder="0"
                    onChange={(e) =>
                      setQtd((prev) => ({
                        ...prev,
                        [p.id]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  {q > 0 ? brl(p.custo * q) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <label htmlFor="obs">Observação</label>
      <textarea
        id="obs"
        rows={3}
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Opcional"
      />

      <div className="between" style={{ marginTop: 20 }}>
        <span className="muted">Valor de custo total do pedido</span>
        <span className="total">{brl(total)}</span>
      </div>

      <div className="check-row">
        <input
          id="ciente"
          type="checkbox"
          checked={ciente}
          onChange={(e) => setCiente(e.target.checked)}
        />
        <label htmlFor="ciente" style={{ margin: 0 }}>
          Estou ciente dos valores apresentados neste pedido.
        </label>
      </div>

      {erro && <p className="error">{erro}</p>}

      <button onClick={enviar} disabled={!podeEnviar}>
        {salvando ? "Registrando…" : "Registrar pedido"}
      </button>
    </div>
  );
}
