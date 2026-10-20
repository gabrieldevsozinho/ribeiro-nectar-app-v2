import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatarMoeda } from "@/compartilhado/formato";
import { chave } from "../../api";
import { carregarVendasDoPonto } from "../../chamadas";
import { CartaoVenda } from "./cartao-venda";
import { IconeFechar, IconeSeta, IconeVoltar } from "../icones";
import { Carregando, ErroCarregar, Vazio } from "../ui";

export type PontoResumo = {
  id: string;
  nome: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  vendas: number;
  valorTotal: number;
};

/** Pop-up com as vendas de um ponto, 10 por página, buscadas uma página por vez. */
export function PopupVendasPonto({ slug, ponto, aoFechar }: { slug: string; ponto: PontoResumo; aoFechar: () => void }) {
  const [pagina, setPagina] = useState(1);
  const dialogo = useRef<HTMLDialogElement>(null);
  const consulta = useQuery({
    queryKey: chave(slug, "pontos", ponto.id, "vendas", pagina),
    queryFn: () => carregarVendasDoPonto(slug, ponto.id, pagina),
    placeholderData: keepPreviousData,
  });
  const dados = consulta.data;
  const carregando = consulta.isPending || consulta.isPlaceholderData;

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
      className="m-auto max-h-[90dvh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-[var(--radius-cartao)] border border-borda bg-fundo p-0 text-texto shadow-2xl backdrop:bg-black/45"
      aria-labelledby="popup-ponto-titulo"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-borda bg-superficie px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="popup-ponto-titulo" className="font-titulo text-xl font-bold">
              {ponto.nome}
            </h2>
            <p className="text-sm text-texto-2">
              {[ponto.logradouro, ponto.numero].filter(Boolean).join(", ")}
              {ponto.bairro && ` · ${ponto.bairro}`} · {ponto.cidade}/{ponto.uf}
            </p>
            <p className="mt-1 text-sm">
              <strong>{ponto.vendas}</strong> {ponto.vendas === 1 ? "venda" : "vendas"} · <strong>{formatarMoeda(ponto.valorTotal)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-texto-2 hover:bg-superficie-2"
            aria-label="Fechar"
          >
            <IconeFechar />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {consulta.isError ? (
            <ErroCarregar erro={consulta.error} aoTentar={() => consulta.refetch()} />
          ) : carregando || !dados ? (
            <Carregando texto="Buscando vendas…" />
          ) : dados.vendas.length === 0 ? (
            <Vazio titulo="Nenhuma venda visível neste ponto" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {dados.vendas.map((v) => (
                <CartaoVenda key={v.id} venda={v} slug={slug} mostrarPonto={false} />
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-borda bg-superficie px-5 py-3">
          <button
            type="button"
            disabled={pagina <= 1 || carregando}
            onClick={() => setPagina(pagina - 1)}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-borda-forte px-3 text-sm font-semibold disabled:opacity-40"
          >
            <IconeVoltar tamanho={16} /> Anterior
          </button>
          <span className="text-sm text-texto-2">{dados ? `Página ${dados.pagina} de ${dados.paginas}` : "…"}</span>
          <button
            type="button"
            disabled={!dados || pagina >= dados.paginas || carregando}
            onClick={() => setPagina(pagina + 1)}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-borda-forte px-3 text-sm font-semibold disabled:opacity-40"
          >
            Próxima <IconeSeta tamanho={16} />
          </button>
        </footer>
        <Link
          to={`/${slug}/pontos/${ponto.id}`}
          className="border-t border-borda py-2.5 text-center text-sm font-semibold text-mel-texto hover:bg-superficie-2"
        >
          Abrir a página do ponto
        </Link>
      </div>
    </dialog>
  );
}
