import { useState } from "react";
import { formatarMoeda, formatarNumero, lerQuantidade, lerValorEmReais, subtotalEmReais } from "@/compartilhado/formato";
import type { ProdutoCatalogo } from "@/compartilhado/tipos";
import { IconeFechar, IconeMais } from "../icones";

export type ItemEmMontagem = { chave: number; produtoId: string; quantidade: number; precoUnitario: number };

function precoParaCampo(valor: number) {
  return Number(valor).toFixed(2).replace(".", ",");
}

export function totalDosItens(itens: ItemEmMontagem[]) {
  return itens.reduce((soma, i) => soma + subtotalEmReais(i.quantidade, i.precoUnitario), 0);
}

/**
 * Monta a lista de itens da venda. Enquanto a venda não é confirmada, dá para
 * tirar um item da lista; depois de salva, só é possível acrescentar.
 */
export function MontadorItens({
  produtos,
  itens,
  aoMudar,
}: {
  produtos: ProdutoCatalogo[];
  itens: ItemEmMontagem[];
  aoMudar: (itens: ItemEmMontagem[]) => void;
}) {
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");
  const [erro, setErro] = useState<string>();

  const porId = new Map(produtos.map((p) => [p.id, p]));
  const total = totalDosItens(itens);

  function escolherProduto(id: string) {
    setProdutoId(id);
    const produto = porId.get(id);
    setPreco(produto ? precoParaCampo(produto.precoSugerido) : "");
    setErro(undefined);
  }

  function adicionar() {
    const q = lerQuantidade(quantidade);
    const p = lerValorEmReais(preco);
    if (!porId.has(produtoId)) return setErro("Escolha o produto.");
    if (q === null || q <= 0) return setErro("Informe a quantidade.");
    if (p === null || p < 0) return setErro("Informe o preço.");
    aoMudar([...itens, { chave: Date.now(), produtoId, quantidade: q, precoUnitario: p }]);
    setProdutoId("");
    setQuantidade("1");
    setPreco("");
    setErro(undefined);
  }

  const campo =
    "min-h-12 w-full rounded-xl border border-borda-forte bg-superficie px-3 text-[16px] text-texto focus:border-mel";

  return (
    <div className="flex flex-col gap-4">
      {itens.length > 0 && (
        <ul className="divide-y divide-borda rounded-xl border border-borda">
          {itens.map((item) => {
            const produto = porId.get(item.produtoId);
            return (
              <li key={item.chave} className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {formatarNumero(item.quantidade)} × {produto?.nome}
                  </p>
                  <p className="text-sm text-texto-2">
                    {produto?.unidade} · {formatarMoeda(item.precoUnitario)} cada
                  </p>
                </div>
                <span className="font-semibold">{formatarMoeda(subtotalEmReais(item.quantidade, item.precoUnitario))}</span>
                <button
                  type="button"
                  onClick={() => aoMudar(itens.filter((i) => i.chave !== item.chave))}
                  className="flex size-9 items-center justify-center rounded-lg text-texto-3 hover:bg-superficie-2 hover:text-erro"
                  aria-label={`Tirar ${produto?.nome} da lista`}
                >
                  <IconeFechar tamanho={18} />
                </button>
              </li>
            );
          })}
          <li className="flex items-center justify-between bg-superficie-2 px-3.5 py-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">{formatarMoeda(total)}</span>
          </li>
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-borda-forte p-3.5">
        <p className="mb-2 text-sm font-semibold">{itens.length ? "Adicionar outro item" : "Adicionar item"}</p>
        <div className="flex flex-col gap-2.5">
          <select aria-label="Produto" value={produtoId} onChange={(e) => escolherProduto(e.target.value)} className={campo}>
            <option value="">Escolha o produto…</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.unidade}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Quantidade
              <input inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Preço unitário (R$)
              <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} className={campo} placeholder="0,00" />
            </label>
          </div>
          {erro && <p className="text-sm text-erro">{erro}</p>}
          <button
            type="button"
            onClick={adicionar}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mel-claro font-semibold text-mel-texto hover:bg-mel hover:text-sobre-mel"
          >
            <IconeMais tamanho={18} /> Adicionar à venda
          </button>
        </div>
      </div>
    </div>
  );
}
