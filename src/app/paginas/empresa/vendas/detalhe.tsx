import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/compartilhado/formato";
import type { ProdutoCatalogo, VendaDetalhe } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila } from "../../../api";
import { Aviso, Botao, Carregando, Cartao, ErroCarregar, LinkVoltar, TituloPagina, useTitulo } from "../../../componentes/ui";
import { MontadorItens, type ItemEmMontagem } from "../../../componentes/vendas/montador-itens";
import { useConfigMapa, useUsuario } from "../contexto";
import { MapaDoPonto } from "../pontos/mapa-do-ponto";

export default function PaginaVenda() {
  useTitulo("Venda");
  const slug = useUsuario().empresa.slug;
  const id = useParams().id ?? "";
  const registrada = useSearchParams()[0].get("registrada");
  const venda = useQuery({ queryKey: chave(slug, "vendas", id), queryFn: () => api.get<VendaDetalhe>(daEmpresa(slug, `/vendas/${id}`)) });
  const mapa = useConfigMapa(slug);

  if (venda.isError) return <ErroCarregar erro={venda.error} aoTentar={() => venda.refetch()} />;
  if (!venda.data || !mapa.data) return <Carregando />;

  const v = venda.data;
  const ponto = v.ponto;
  const minutoDaVenda = v.dataVenda.slice(0, 16);
  const resumoMarcador = {
    titulo: ponto.nome,
    linhas: [
      ...v.itens.map((i) => `${formatarNumero(i.quantidade)} × ${i.produto} (${i.unidade})`),
      `Total: ${formatarMoeda(v.valorTotal)}`,
      `Quando: ${formatarDataHora(v.dataVenda)}`,
      `Quem vendeu: ${v.vendedor}`,
    ],
  };

  return (
    <>
      <LinkVoltar para={`/${slug}/vendas`}>Vendas</LinkVoltar>
      <TituloPagina titulo={`Venda de ${formatarMoeda(v.valorTotal)}`} descricao={formatarDataHora(v.dataVenda)} />

      {registrada && (
        <Aviso tipo="sucesso" titulo="Venda registrada" className="mb-5 max-w-3xl">
          Se precisar, ainda dá para acrescentar itens. O que já foi registrado não pode ser removido.
        </Aviso>
      )}

      <div className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">O que foi vendido</h2>
            <ul className="mt-3 divide-y divide-borda">
              {v.itens.map((item) => {
                const acrescentado = item.adicionadoEm.slice(0, 16) > minutoDaVenda;
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {formatarNumero(item.quantidade)} × {item.produto}
                      </p>
                      <p className="text-sm text-texto-2">
                        {item.unidade} · {formatarMoeda(item.precoUnitario)} cada
                        {acrescentado && ` · acrescentado em ${formatarDataHora(item.adicionadoEm)}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">{formatarMoeda(item.subtotal)}</span>
                  </li>
                );
              })}
              <li className="flex items-center justify-between pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">{formatarMoeda(v.valorTotal)}</span>
              </li>
            </ul>
          </Cartao>

          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Onde foi a venda</h2>
            <p className="mt-1 mb-3 text-sm text-texto-2">Toque no marcador para ver o resumo da venda.</p>
            <MapaDoPonto
              config={mapa.data}
              pontoId={ponto.id}
              coordenadas={ponto.latitude != null && ponto.longitude != null ? { lat: ponto.latitude, lng: ponto.longitude } : null}
              podeAjustar={false}
              resumo={resumoMarcador}
              altura="h-80"
              textoSemLocalizacao="Este comércio ainda não tem localização no mapa. Ela pode ser definida na página do ponto de venda."
            />
          </Cartao>
        </div>

        <div className="flex flex-col gap-5">
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Detalhes</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="text-texto-3">Para quem</dt>
                <dd>
                  <Link to={`/${slug}/pontos/${ponto.id}`} className="font-semibold text-mel-texto hover:underline">
                    {ponto.nome}
                  </Link>
                  <span className="block text-texto-2">
                    {[ponto.logradouro, ponto.numero].filter(Boolean).join(", ")}
                    {ponto.bairro && ` · ${ponto.bairro}`} · {ponto.cidade}/{ponto.uf}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-texto-3">Quem vendeu</dt>
                <dd className="font-semibold">{v.vendedor}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Quando</dt>
                <dd className="font-semibold">{formatarDataHora(v.dataVenda)}</dd>
              </div>
              {v.observacao && (
                <div>
                  <dt className="text-texto-3">Observação</dt>
                  <dd>{v.observacao}</dd>
                </div>
              )}
            </dl>
          </Cartao>

          {v.ehMinha && (
            <Cartao>
              <h2 className="font-titulo text-lg font-bold">Acrescentar itens</h2>
              <p className="mt-1 mb-3 text-sm text-texto-2">O comércio pediu mais? Acrescente aqui. Nada do que já foi vendido muda.</p>
              <AcrescentarItens slug={slug} vendaId={v.id} produtos={v.produtos} />
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}

function AcrescentarItens({ slug, vendaId, produtos }: { slug: string; vendaId: string; produtos: ProdutoCatalogo[] }) {
  const [itens, setItens] = useState<ItemEmMontagem[]>([]);
  const acrescentar = useMutation({
    mutationFn: () =>
      api.post<{ sucesso: string }>(daEmpresa(slug, `/vendas/${vendaId}/itens`), {
        itens: itens.map(({ produtoId, quantidade, precoUnitario }) => ({ produtoId, quantidade, precoUnitario })),
      }),
    onSuccess: () => {
      setItens([]);
      // O total mudou: recarrega a venda e as listas.
      return fila.invalidateQueries({ queryKey: chave(slug) });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {acrescentar.isError && <Aviso tipo="erro">{acrescentar.error.message}</Aviso>}
      {acrescentar.isSuccess && itens.length === 0 && <Aviso tipo="sucesso">{acrescentar.data.sucesso}</Aviso>}
      <MontadorItens
        produtos={produtos}
        itens={itens}
        aoMudar={(novos) => {
          acrescentar.reset();
          setItens(novos);
        }}
      />
      {itens.length > 0 && (
        <Botao type="button" disabled={acrescentar.isPending} onClick={() => acrescentar.mutate()}>
          {acrescentar.isPending ? "Salvando…" : "Confirmar acréscimo"}
        </Botao>
      )}
    </div>
  );
}
