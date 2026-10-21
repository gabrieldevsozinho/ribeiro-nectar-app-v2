import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatarCep, formatarMoeda } from "@/compartilhado/formato";
import { haQuantoTempo, ROTULO_SITUACAO, type Situacao } from "@/compartilhado/semaforo";
import { chave } from "../../api";
import { carregarVendasDoPonto } from "../../chamadas";
import { CartaoVenda } from "./cartao-venda";
import { IconeFechar, IconeSeta, IconeVoltar } from "../icones";
import { Bolinha, COR_TEXTO_SITUACAO } from "../mapa/situacao";
import { BotaoLink, Carregando, ErroCarregar, Vazio } from "../ui";

export type PontoResumo = {
  id: string;
  nome: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  vendas: number;
  valorTotal: number;
};

const temCoordenadas = (p: PontoResumo) => p.latitude != null && p.longitude != null;

/**
 * Rota até o comércio no Google Maps e no Waze: pelo pino; sem pino, pelo endereço no formato que o
 * Google entende ("Av. Brasil, 120 - Cidade, UF, 38320-000"). O bairro fica de fora: atrapalha a busca.
 */
function linksDeRota(p: PontoResumo) {
  const rua = [p.logradouro, p.numero].filter(Boolean).join(", ");
  const endereco = `${rua} - ${p.cidade}, ${p.uf}${p.cep ? `, ${formatarCep(p.cep)}` : ""}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(temCoordenadas(p) ? `${p.latitude},${p.longitude}` : endereco)}`,
    waze: temCoordenadas(p)
      ? `https://waze.com/ul?ll=${p.latitude},${p.longitude}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`,
  };
}

const BOTAO_ROTA =
  "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-borda-forte bg-superficie px-3 text-sm font-semibold text-texto hover:bg-superficie-2";

/** Pop-up com as vendas de um ponto, 10 por página, buscadas uma página por vez. */
export function PopupVendasPonto({
  slug,
  ponto,
  ultimaVenda,
  aoFechar,
}: {
  slug: string;
  ponto: PontoResumo;
  /** Dias desde a última venda e a cor do semáforo (null se o master ainda não definiu os prazos). */
  ultimaVenda?: { dias: number; situacao: Situacao | null };
  aoFechar: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const dialogo = useRef<HTMLDialogElement>(null);
  const consulta = useQuery({
    queryKey: chave(slug, "pontos", ponto.id, "vendas", pagina),
    queryFn: () => carregarVendasDoPonto(slug, ponto.id, pagina),
    placeholderData: keepPreviousData,
  });
  const dados = consulta.data;
  const carregando = consulta.isPending || consulta.isPlaceholderData;
  const rota = linksDeRota(ponto);

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
            {ultimaVenda && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm">
                {ultimaVenda.situacao && (
                  <>
                    <Bolinha situacao={ultimaVenda.situacao} />
                    <strong className={COR_TEXTO_SITUACAO[ultimaVenda.situacao]}>{ROTULO_SITUACAO[ultimaVenda.situacao]}</strong>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>última venda {haQuantoTempo(ultimaVenda.dias)}</span>
              </p>
            )}
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

        <div className="flex flex-col gap-2 border-b border-borda bg-superficie px-5 pb-4">
          <BotaoLink to={`/${slug}/vendas/nova?ponto=${ponto.id}`} className="w-full">
            Registrar venda aqui
          </BotaoLink>
          <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="popup-ponto-rota">
            <p id="popup-ponto-rota" className="col-span-2 -mb-1 text-xs font-semibold text-texto-2">
              Como chegar
            </p>
            <a href={rota.google} target="_blank" rel="noreferrer" className={BOTAO_ROTA}>
              Google Maps
            </a>
            <a href={rota.waze} target="_blank" rel="noreferrer" className={BOTAO_ROTA}>
              Waze
            </a>
            {!temCoordenadas(ponto) && (
              <p className="col-span-2 text-xs text-texto-2">
                Este comércio ainda não tem pino no mapa: a rota vai pelo endereço digitado e pode não ser achada.{" "}
                <Link to={`/${slug}/pontos/${ponto.id}/editar`} className="font-semibold text-mel-texto underline underline-offset-2">
                  Ajustar o pino
                </Link>{" "}
                resolve.
              </p>
            )}
          </div>
        </div>

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
