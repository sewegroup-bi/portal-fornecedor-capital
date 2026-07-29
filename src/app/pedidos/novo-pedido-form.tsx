"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { criarPedido } from "./actions";

type Produto = {
  id: string;
  codigo_fornecedor: string;
  nome: string;
  custo: number;
};

const PAGE_SIZE = 50;
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function NovoPedidoForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState(""); // com debounce
  const [page, setPage] = useState(0);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // seleção do "carrinho" — sobrevive a busca/paginação
  const [selecionados, setSelecionados] = useState<
    Record<string, { produto: Produto; quantidade: number }>
  >({});
  const [observacao, setObservacao] = useState("");
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // debounce curto da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAtiva(busca.trim());
      setPage(0);
    }, 200);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelado = false; // descarta resposta de busca antiga (evita "piscar" resultado errado)
    setCarregando(true);

    (async () => {
      const { data, error } = await supabase.rpc("buscar_produtos", {
        p_termo: buscaAtiva,
        p_offset: page * PAGE_SIZE,
        p_limit: PAGE_SIZE + 1, // 1 a mais só para saber se existe próxima página
      });
      if (cancelado) return;
      if (!error && data) {
        setTemMais(data.length > PAGE_SIZE);
        setProdutos(data.slice(0, PAGE_SIZE) as Produto[]);
      }
      setCarregando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [supabase, buscaAtiva, page]);

  function setQtd(produto: Produto, valor: number) {
    setSelecionados((prev) => {
      const n = { ...prev };
      if (!valor || valor <= 0) delete n[produto.id];
      else n[produto.id] = { produto, quantidade: valor };
      return n;
    });
  }

  const itens = Object.values(selecionados);
  const total = itens.reduce((s, i) => s + i.produto.custo * i.quantidade, 0);
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
    setSelecionados({});
    setObservacao("");
    setCiente(false);
    router.refresh();
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar produto por nome ou código…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div className="between" style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {carregando
            ? "Buscando…"
            : `${produtos.length} produto(s) · página ${page + 1}${
                buscaAtiva ? ` · contendo "${buscaAtiva}"` : ""
              }`}
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          {itens.length > 0 && (
            <strong>{itens.length} item(ns) selecionado(s)</strong>
          )}
        </span>
      </div>

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
            const q = selecionados[p.id]?.quantidade ?? 0;
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
                      setQtd(p, Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  {q > 0 ? brl(p.custo * q) : "—"}
                </td>
              </tr>
            );
          })}
          {!carregando && produtos.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nenhum produto encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <button
          className="secondary"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || carregando}
        >
          ← Anterior
        </button>
        <button
          className="secondary"
          onClick={() => setPage((p) => p + 1)}
          disabled={!temMais || carregando}
        >
          Próxima →
        </button>
      </div>

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
