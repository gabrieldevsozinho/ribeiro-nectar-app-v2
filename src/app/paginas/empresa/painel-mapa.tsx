import { useMemo, useState } from "react";
import { ProvedorMapa, type ConfigMapaCliente } from "../../componentes/mapa/provedor-mapa";
import { MapaVendas } from "../../componentes/mapa/mapa-vendas";
import { MapaVendasOsm } from "../../componentes/mapa/osm/mapa-vendas-osm";
import { PopupVendasPonto, type PontoResumo } from "../../componentes/vendas/popup-vendas-ponto";
import { IconePredio, IconeSeta, IconeVoltar } from "../../componentes/icones";
import { Selo, Vazio } from "../../componentes/ui";
import { formatarData, formatarMoeda } from "@/compartilhado/formato";

type Cidade = { chave: string; cidade: string; uf: string; pontos: number; vendas: number; ultimaVenda: string };
type Ponto = PontoResumo & {
  latitude: number | null;
  longitude: number | null;
  localizacaoStatus: string;
  ultimaVenda: string;
};

export function PainelMapa({ mapa, cidades, pontos }: { mapa: ConfigMapaCliente; cidades: Cidade[]; pontos: Ponto[] }) {
  const [cidadeEscolhida, setCidadeEscolhida] = useState<string | null>(null);
  const [pontoAberto, setPontoAberto] = useState<Ponto | null>(null);
  const [aba, setAba] = useState<"cidades" | "mapa">("cidades");

  const pontosDaCidade = useMemo(
    () => (cidadeEscolhida ? pontos.filter((p) => `${p.cidade}|${p.uf}` === cidadeEscolhida) : []),
    [cidadeEscolhida, pontos],
  );
  const marcadores = useMemo(
    () =>
      pontos
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          lat: p.latitude!,
          lng: p.longitude!,
          destacado: cidadeEscolhida === `${p.cidade}|${p.uf}`,
        })),
    [pontos, cidadeEscolhida],
  );
  const semLocalizacao = pontos.length - marcadores.length;
  const cidade = cidades.find((c) => c.chave === cidadeEscolhida);

  if (pontos.length === 0) {
    return <Vazio titulo="Ainda não há vendas para mostrar no mapa">Assim que houver vendas, os comércios aparecem aqui.</Vazio>;
  }

  const abaBotao = (valor: typeof aba, rotulo: string) => (
    <button
      type="button"
      onClick={() => setAba(valor)}
      aria-pressed={aba === valor}
      className={`min-h-10 flex-1 rounded-lg text-sm font-semibold ${aba === valor ? "bg-superficie text-texto shadow-sm" : "text-texto-2"}`}
    >
      {rotulo}
    </button>
  );

  return (
    <>
      {/* No celular, as duas partes viram abas. */}
      <div className="mb-3 flex gap-1 rounded-xl bg-superficie-2 p-1 lg:hidden">
        {abaBotao("cidades", "Cidades")}
        {abaBotao("mapa", "Mapa")}
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-210px)] lg:min-h-[520px] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Menu lateral: cidades → pontos → vendas */}
        <aside
          className={`${aba === "cidades" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-[var(--radius-cartao)] border border-borda bg-superficie lg:flex`}
          aria-label="Cidades onde houve vendas"
        >
          {cidade ? (
            <>
              <div className="border-b border-borda px-4 py-3">
                <button
                  type="button"
                  onClick={() => setCidadeEscolhida(null)}
                  className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-texto-2 hover:text-texto"
                >
                  <IconeVoltar tamanho={16} /> Todas as cidades
                </button>
                <p className="font-titulo text-lg font-bold">
                  {cidade.cidade}/{cidade.uf}
                </p>
                <p className="text-sm text-texto-2">
                  {cidade.pontos} {cidade.pontos === 1 ? "ponto" : "pontos"} · {cidade.vendas} vendas
                </p>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-borda overflow-y-auto">
                {pontosDaCidade.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPontoAberto(p)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.nome}</p>
                        <p className="truncate text-sm text-texto-2">
                          {[p.logradouro, p.numero].filter(Boolean).join(", ")}
                        </p>
                        <p className="text-sm text-texto-2">
                          {p.vendas} vendas · {formatarMoeda(p.valorTotal)}
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
            </>
          ) : (
            <>
              <div className="border-b border-borda px-4 py-3">
                <p className="font-titulo text-lg font-bold">Cidades</p>
                <p className="text-sm text-texto-2">{cidades.length} cidades com vendas</p>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-borda overflow-y-auto">
                {cidades.map((c) => (
                  <li key={c.chave}>
                    <button
                      type="button"
                      onClick={() => setCidadeEscolhida(c.chave)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2"
                    >
                      <IconePredio className="shrink-0 text-texto-3" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {c.cidade}/{c.uf}
                        </p>
                        <p className="text-sm text-texto-2">
                          {c.pontos} {c.pontos === 1 ? "ponto" : "pontos"} · {c.vendas} vendas · última em{" "}
                          {formatarData(c.ultimaVenda)}
                        </p>
                      </div>
                      <IconeSeta className="shrink-0 text-texto-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* Mapa */}
        <section className={`${aba === "mapa" ? "flex" : "hidden"} min-h-0 flex-col gap-2 lg:flex`} aria-label="Mapa de vendas">
          <div className="h-[60dvh] min-h-80 overflow-hidden rounded-[var(--radius-cartao)] border border-borda lg:h-full">
            <ProvedorMapa config={mapa} altura="h-full">
              {(() => {
                const Mapa = mapa.provedor === "osm" ? MapaVendasOsm : MapaVendas;
                return (
                  <Mapa
                    pontos={marcadores}
                    aoEscolher={(id) => {
                      const ponto = pontos.find((p) => p.id === id);
                      if (ponto) setPontoAberto(ponto);
                    }}
                  />
                );
              })()}
            </ProvedorMapa>
          </div>
          {semLocalizacao > 0 && mapa.disponivel && (
            <p className="text-sm text-texto-2">
              {semLocalizacao} {semLocalizacao === 1 ? "ponto ainda não tem" : "pontos ainda não têm"} localização e{" "}
              {semLocalizacao === 1 ? "aparece" : "aparecem"} só na lista de cidades.
            </p>
          )}
        </section>
      </div>

      {pontoAberto && <PopupVendasPonto slug={mapa.slug} ponto={pontoAberto} aoFechar={() => setPontoAberto(null)} />}
    </>
  );
}
