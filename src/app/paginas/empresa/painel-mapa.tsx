import { useMemo, useRef, useState } from "react";
import { chaveCidade, melhorGrafia } from "@/compartilhado/cidades";
import { contar } from "@/compartilhado/formato";
import {
  diasDesde,
  faixasDosPrazos,
  haQuantoTempo,
  ROTULO_SITUACAO,
  SITUACOES,
  situacaoPelosDias,
  type Situacao,
} from "@/compartilhado/semaforo";
import type { PontoComVendas, PrazosVisita } from "@/compartilhado/tipos";
import { ProvedorMapa, type ConfigMapaCliente } from "../../componentes/mapa/provedor-mapa";
import { MapaVendas, type Coordenada, type MarcadorPonto } from "../../componentes/mapa/mapa-vendas";
import { MapaVendasOsm } from "../../componentes/mapa/osm/mapa-vendas-osm";
import { Bolinha, COR_TEXTO_SITUACAO } from "../../componentes/mapa/situacao";
import { PopupVendasPonto } from "../../componentes/vendas/popup-vendas-ponto";
import { IconeAlvo, IconePredio, IconeSeta, IconeVoltar } from "../../componentes/icones";
import { Aviso, Selo, Vazio } from "../../componentes/ui";

/** Comércio no mapa, com os dias desde a última venda e a cor do semáforo (null sem prazos). */
type PontoNoMapa = PontoComVendas & { chaveCidade: string; dias: number; situacao: Situacao | null };

type Cidade = {
  chave: string;
  nome: string;
  uf: string;
  pontos: PontoNoMapa[];
  vendas: number;
  /** Dias desde a venda mais recente na cidade. */
  dias: number;
  porSituacao: Record<Situacao, number>;
};

type Filtro = "todos" | Situacao;

const ROTULO_FILTRO: Record<Situacao, string> = { em_dia: "Em dia", atencao: "Atenção", atrasado: "Atrasados" };

const CONTAGEM_SITUACAO: Record<Situacao, (n: number) => string> = {
  atrasado: (n) => contar(n, "atrasado", "atrasados"),
  atencao: (n) => `${n} em atenção`,
  em_dia: (n) => `${n} em dia`,
};

const NENHUM_NO_FILTRO: Record<Situacao, string> = {
  atrasado: "Nenhum comércio atrasado nesta cidade.",
  atencao: "Nenhum comércio em atenção nesta cidade.",
  em_dia: "Nenhum comércio em dia nesta cidade.",
};

/** Até esta distância do comércio mais próximo, o "Estou aqui" abre a cidade dele. */
const RAIO_CIDADE_KM = 25;

function distanciaKm(a: Coordenada, b: Coordenada) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const temLocal = (p: PontoNoMapa): p is PontoNoMapa & { latitude: number; longitude: number } =>
  p.latitude != null && p.longitude != null;

/** Junta os comércios por cidade ("Santa Vitória" e "Santa Vitoria" são a mesma). */
function agruparCidades(pontos: PontoNoMapa[]): Cidade[] {
  const grupos = new Map<string, PontoNoMapa[]>();
  for (const p of pontos) grupos.set(p.chaveCidade, [...(grupos.get(p.chaveCidade) ?? []), p]);
  return [...grupos.entries()]
    .map(([chave, lista]) => {
      const usos = new Map<string, number>();
      const porSituacao: Record<Situacao, number> = { em_dia: 0, atencao: 0, atrasado: 0 };
      for (const p of lista) {
        usos.set(p.cidade, (usos.get(p.cidade) ?? 0) + 1);
        if (p.situacao) porSituacao[p.situacao]++;
      }
      return {
        chave,
        nome: melhorGrafia([...usos].map(([cidade, n]) => ({ cidade, usos: n }))),
        uf: lista[0]!.uf,
        pontos: lista,
        vendas: lista.reduce((soma, p) => soma + p.vendas, 0),
        dias: Math.min(...lista.map((p) => p.dias)),
        porSituacao,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.uf.localeCompare(b.uf));
}

export function PainelMapa({
  mapa,
  pontos: dados,
  prazos,
  ehMaster,
  aoAlterarPrazos,
}: {
  mapa: ConfigMapaCliente;
  pontos: PontoComVendas[];
  prazos: PrazosVisita | null;
  ehMaster: boolean;
  aoAlterarPrazos: () => void;
}) {
  const [cidadeEscolhida, setCidadeEscolhida] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pontoAberto, setPontoAberto] = useState<PontoNoMapa | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [minhaPosicao, setMinhaPosicao] = useState<Coordenada | null>(null);
  const [buscandoPosicao, setBuscandoPosicao] = useState(false);
  const [avisoPosicao, setAvisoPosicao] = useState<{ tipo: "info" | "erro"; texto: string; cidade?: Cidade } | null>(null);
  const [vezesEstouAqui, setVezesEstouAqui] = useState(0);
  const areaMapa = useRef<HTMLElement>(null);

  const pontos = useMemo<PontoNoMapa[]>(
    () =>
      dados.map((p) => {
        const dias = diasDesde(p.ultimaVenda);
        return { ...p, chaveCidade: chaveCidade(p.cidade, p.uf), dias, situacao: prazos ? situacaoPelosDias(dias, prazos) : null };
      }),
    [dados, prazos],
  );
  const cidades = useMemo(() => agruparCidades(pontos), [pontos]);
  const cidade = cidades.find((c) => c.chave === cidadeEscolhida) ?? null;

  // Na cidade, os mais atrasados primeiro (mais dias desde a última venda).
  const pontosDaCidade = useMemo(
    () => (cidade ? [...cidade.pontos].sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, "pt-BR")) : []),
    [cidade],
  );
  const visiveis = useMemo(
    () => (filtro === "todos" ? pontosDaCidade : pontosDaCidade.filter((p) => p.situacao === filtro)),
    [pontosDaCidade, filtro],
  );
  // Com uma cidade aberta, o mapa mostra só os comércios dela (e do filtro).
  const noMapa = cidade ? visiveis : pontos;
  const marcadores = useMemo<MarcadorPonto[]>(
    () =>
      noMapa
        .filter(temLocal)
        .map((p) => ({ id: p.id, nome: p.nome, lat: p.latitude, lng: p.longitude, situacao: p.situacao, selecionado: p.id === foco })),
    [noMapa, foco],
  );
  const semLocalizacao = noMapa.length - noMapa.filter(temLocal).length;

  function mostrarMapa() {
    // No celular a lista fica embaixo do mapa: ao trocar de cidade, volta para o mapa.
    const area = areaMapa.current;
    if (area && area.getBoundingClientRect().top < 0) area.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escolherCidade(chave: string | null) {
    setCidadeEscolhida(chave);
    setFiltro("todos");
    setFoco(null);
    setAvisoPosicao(null);
    mostrarMapa();
  }

  function abrirPonto(p: PontoNoMapa) {
    setFoco(p.id);
    setPontoAberto(p);
  }

  /** Usa o GPS do aparelho: mostra a posição no mapa e abre a cidade onde a pessoa está. */
  function estouAqui() {
    if (!("geolocation" in navigator)) {
      setAvisoPosicao({ tipo: "erro", texto: "Este aparelho não informa a localização." });
      return;
    }
    setBuscandoPosicao(true);
    setAvisoPosicao(null);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setBuscandoPosicao(false);
        const eu = { lat: posicao.coords.latitude, lng: posicao.coords.longitude };
        setMinhaPosicao(eu);
        setVezesEstouAqui((n) => n + 1);
        const maisPerto = pontos
          .filter(temLocal)
          .map((p) => ({ p, km: distanciaKm(eu, { lat: p.latitude, lng: p.longitude }) }))
          .sort((a, b) => a.km - b.km)[0];
        const cidadeMaisPerto = maisPerto && cidades.find((c) => c.chave === maisPerto.p.chaveCidade);
        if (!maisPerto || !cidadeMaisPerto) return;
        if (maisPerto.km <= RAIO_CIDADE_KM) {
          escolherCidade(cidadeMaisPerto.chave);
        } else {
          setAvisoPosicao({
            tipo: "info",
            texto: `Não há comércios com vendas perto de você. O mais próximo fica em ${cidadeMaisPerto.nome}/${cidadeMaisPerto.uf}, a ${Math.round(maisPerto.km)} km.`,
            cidade: cidadeMaisPerto,
          });
        }
      },
      (erro) => {
        setBuscandoPosicao(false);
        setAvisoPosicao({
          tipo: "erro",
          texto:
            erro.code === erro.PERMISSION_DENIED
              ? "Sem permissão para ver a sua localização. Libere a localização deste site nas configurações do navegador e toque em “Estou aqui” de novo."
              : "Não foi possível descobrir onde você está. Confira se a localização (GPS) do celular está ligada e tente de novo.",
        });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  if (pontos.length === 0) {
    return <Vazio titulo="Ainda não há vendas para mostrar no mapa">Assim que houver vendas, os comércios aparecem aqui.</Vazio>;
  }

  const Mapa = mapa.provedor === "osm" ? MapaVendasOsm : MapaVendas;

  return (
    <>
      {/* Celular: mapa em cima e a lista embaixo, na mesma tela. Computador: lista à esquerda. */}
      <div className="flex flex-col gap-3 lg:grid lg:h-[calc(100dvh-200px)] lg:min-h-[540px] lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-4">
        <section ref={areaMapa} aria-label="Mapa de vendas" className="flex min-w-0 scroll-mt-16 flex-col gap-2 lg:order-2 lg:min-h-0">
          <div className="relative h-[44dvh] min-h-64 overflow-hidden rounded-[var(--radius-cartao)] border border-borda lg:h-auto lg:min-h-0 lg:flex-1">
            <ProvedorMapa config={mapa} altura="h-full">
              <Mapa
                pontos={marcadores}
                minhaPosicao={minhaPosicao}
                enquadramento={`${cidadeEscolhida ?? "todas"}|${filtro}|${vezesEstouAqui}`}
                foco={foco}
                aoEscolher={(id) => {
                  const ponto = pontos.find((p) => p.id === id);
                  if (ponto) abrirPonto(ponto);
                }}
              />
            </ProvedorMapa>
            <button
              type="button"
              onClick={estouAqui}
              disabled={buscandoPosicao}
              className="absolute right-2.5 top-2.5 z-[1000] inline-flex min-h-11 items-center gap-2 rounded-full border border-borda-forte bg-superficie px-4 text-sm font-semibold text-texto shadow-md hover:bg-superficie-2 disabled:opacity-75"
            >
              <IconeAlvo tamanho={18} className="text-info" />
              {buscandoPosicao ? "Localizando…" : "Estou aqui"}
            </button>
          </div>

          <Legenda prazos={prazos} ehMaster={ehMaster} aoAlterar={aoAlterarPrazos} />

          {avisoPosicao && (
            <Aviso tipo={avisoPosicao.tipo}>
              {avisoPosicao.texto}
              {avisoPosicao.cidade && (
                <button
                  type="button"
                  onClick={() => escolherCidade(avisoPosicao.cidade!.chave)}
                  className="ml-1 font-semibold underline underline-offset-2"
                >
                  Abrir {avisoPosicao.cidade.nome}
                </button>
              )}
            </Aviso>
          )}

          {semLocalizacao > 0 && mapa.disponivel && (
            <p className="text-sm text-texto-3">
              {semLocalizacao === 1
                ? "1 comércio sem localização aparece só na lista."
                : `${semLocalizacao} comércios sem localização aparecem só na lista.`}
            </p>
          )}
        </section>

        {/* Lista: cidades → comércios da cidade */}
        <aside
          aria-label="Cidades onde houve vendas"
          className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-cartao)] border border-borda bg-superficie lg:order-1 lg:min-h-0"
        >
          {cidade ? (
            <>
              <div className="border-b border-borda px-4 py-3">
                <button
                  type="button"
                  onClick={() => escolherCidade(null)}
                  className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-sm font-semibold text-texto-2 hover:text-texto"
                >
                  <IconeVoltar tamanho={16} /> Todas as cidades
                </button>
                <h2 className="font-titulo text-xl font-bold">
                  {cidade.nome}/{cidade.uf}
                </h2>
                <p className="text-sm text-texto-2">
                  {contar(cidade.pontos.length, "comércio", "comércios")} · {contar(cidade.vendas, "venda", "vendas")}
                </p>
                {prazos && (
                  <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Filtrar por situação">
                    {(["todos", ...SITUACOES] as Filtro[]).map((f) => {
                      const ativo = filtro === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setFiltro(f)}
                          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                            ativo ? "border-texto bg-texto text-fundo" : "border-borda-forte bg-superficie text-texto-2 hover:bg-superficie-2"
                          }`}
                        >
                          {f !== "todos" && <Bolinha situacao={f} />}
                          {f === "todos" ? "Todos" : ROTULO_FILTRO[f]}
                          <span className={ativo ? "opacity-75" : "text-texto-3"}>
                            {f === "todos" ? cidade.pontos.length : cidade.porSituacao[f]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {visiveis.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-texto-2">{filtro !== "todos" && NENHUM_NO_FILTRO[filtro]}</p>
              ) : (
                <ul className="divide-y divide-borda lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  {visiveis.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => abrirPonto(p)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-superficie-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{p.nome}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-texto-2">
                            {p.situacao && (
                              <>
                                <Bolinha situacao={p.situacao} />
                                <span className={`font-semibold ${COR_TEXTO_SITUACAO[p.situacao]}`}>{ROTULO_SITUACAO[p.situacao]}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span>última venda {haQuantoTempo(p.dias)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{contar(p.vendas, "venda", "vendas")}</span>
                          </p>
                          <p className="truncate text-sm text-texto-3">
                            {[p.logradouro, p.numero].filter(Boolean).join(", ")}
                            {p.bairro && ` · ${p.bairro}`}
                          </p>
                          {p.localizacaoStatus === "pendente" && (
                            <span className="mt-1 inline-block">
                              <Selo tipo="alerta">Fora do mapa: localização pendente</Selo>
                            </span>
                          )}
                        </div>
                        <IconeSeta className="shrink-0 text-texto-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="border-b border-borda px-4 py-3">
                <h2 className="font-titulo text-xl font-bold">Cidades</h2>
                <p className="text-sm text-texto-2">{contar(cidades.length, "cidade com vendas", "cidades com vendas")}</p>
              </div>
              <ul className="divide-y divide-borda lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {cidades.map((c) => (
                  <li key={c.chave}>
                    <button
                      type="button"
                      onClick={() => escolherCidade(c.chave)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-superficie-2"
                    >
                      <IconePredio className="shrink-0 text-texto-3" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {c.nome}/{c.uf}
                        </p>
                        <p className="text-sm text-texto-2">
                          {contar(c.pontos.length, "comércio", "comércios")} · última venda {haQuantoTempo(c.dias)}
                        </p>
                        {prazos && <ResumoSituacoes contagem={c.porSituacao} />}
                      </div>
                      <IconeSeta className="shrink-0 text-texto-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {pontoAberto && (
        <PopupVendasPonto
          slug={mapa.slug}
          ponto={pontoAberto}
          ultimaVenda={{ dias: pontoAberto.dias, situacao: pontoAberto.situacao }}
          aoFechar={() => setPontoAberto(null)}
        />
      )}
    </>
  );
}

/** "● 2 atrasados ● 1 em atenção ● 5 em dia" (só as que têm comércio). */
function ResumoSituacoes({ contagem }: { contagem: Record<Situacao, number> }) {
  const situacoes = (["atrasado", "atencao", "em_dia"] as const).filter((s) => contagem[s] > 0);
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
      {situacoes.map((s) => (
        <span key={s} className={`inline-flex items-center gap-1.5 font-semibold ${COR_TEXTO_SITUACAO[s]}`}>
          <Bolinha situacao={s} /> {CONTAGEM_SITUACAO[s](contagem[s])}
        </span>
      ))}
    </p>
  );
}

function Legenda({ prazos, ehMaster, aoAlterar }: { prazos: PrazosVisita | null; ehMaster: boolean; aoAlterar: () => void }) {
  if (!prazos) {
    // O master vê o convite para definir os prazos no topo da página.
    return ehMaster ? null : (
      <p className="text-sm text-texto-3">As cores dos comércios aparecem quando o master definir os prazos de visita.</p>
    );
  }
  const faixas = faixasDosPrazos(prazos);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-texto-2" aria-label="Legenda das cores">
      {SITUACOES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <Bolinha situacao={s} />
          <span>
            <strong className="font-semibold text-texto">{ROTULO_SITUACAO[s]}</strong> {faixas[s]}
          </span>
        </span>
      ))}
      {ehMaster && (
        <button type="button" onClick={aoAlterar} className="min-h-8 font-semibold text-mel-texto underline underline-offset-2">
          Alterar prazos
        </button>
      )}
    </div>
  );
}
