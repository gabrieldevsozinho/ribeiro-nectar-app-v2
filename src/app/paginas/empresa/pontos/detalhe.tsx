import { useParams, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatarCep, formatarCnpj } from "@/compartilhado/formato";
import type { PaginaVendas, PontoDetalhe } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../../api";
import { carregarVendasDoPonto } from "../../../chamadas";
import { IconeMais } from "../../../componentes/icones";
import { Paginacao } from "../../../componentes/paginacao";
import { BotaoLink, Carregando, Cartao, ErroCarregar, LinkVoltar, Selo, TituloPagina, Vazio, useTitulo } from "../../../componentes/ui";
import { CartaoVenda } from "../../../componentes/vendas/cartao-venda";
import { useConfigMapa, useUsuario } from "../contexto";
import { MapaDoPonto } from "./mapa-do-ponto";

export default function PaginaPonto() {
  useTitulo("Ponto de venda");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const id = useParams().id ?? "";
  const pagina = Number(useSearchParams()[0].get("pagina")) || 1;

  const ponto = useQuery({ queryKey: chave(slug, "pontos", id), queryFn: () => api.get<PontoDetalhe>(daEmpresa(slug, `/pontos/${id}`)) });
  const vendas = useQuery({
    queryKey: chave(slug, "pontos", id, "vendas", pagina),
    queryFn: (): Promise<PaginaVendas> => carregarVendasDoPonto(slug, id, pagina),
    placeholderData: keepPreviousData,
  });
  const mapa = useConfigMapa(slug);

  if (ponto.isError) return <ErroCarregar erro={ponto.error} aoTentar={() => ponto.refetch()} />;
  if (!ponto.data || !mapa.data) return <Carregando />;

  const p = ponto.data;
  const endereco = [[p.logradouro, p.numero].filter(Boolean).join(", "), p.bairro].filter(Boolean).join(" · ");

  return (
    <>
      <LinkVoltar para={`/${slug}/pontos`}>Pontos de venda</LinkVoltar>
      <TituloPagina
        titulo={p.nome}
        descricao={`${endereco} · ${p.cidade}/${p.uf}`}
        acoes={
          <>
            <BotaoLink to={`/${slug}/vendas/nova?ponto=${p.id}`}>
              <IconeMais tamanho={18} /> Nova venda aqui
            </BotaoLink>
            {p.podeEditar && (
              <BotaoLink to={`/${slug}/pontos/${p.id}/editar`} variante="secundario">
                Editar
              </BotaoLink>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-5">
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Dados</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-texto-3">CNPJ</dt>
                <dd className="font-medium">{p.cnpj ? formatarCnpj(p.cnpj) : "—"}</dd>
              </div>
              <div>
                <dt className="text-texto-3">CEP</dt>
                <dd className="font-medium">{p.cep ? formatarCep(p.cep) : "—"}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Contato</dt>
                <dd className="font-medium">{p.contato || "—"}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Telefone</dt>
                <dd className="font-medium">
                  {p.telefone ? (
                    <a className="text-mel-texto hover:underline" href={`tel:${p.telefone.replace(/\D/g, "")}`}>
                      {p.telefone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </Cartao>

          <Cartao>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-titulo text-lg font-bold">Localização</h2>
              {p.localizacaoStatus === "pendente" ? (
                <Selo tipo="alerta">Pendente</Selo>
              ) : p.localizacaoStatus === "ajustada" ? (
                <Selo tipo="sucesso">Ajustada no mapa</Selo>
              ) : (
                <Selo tipo="sucesso">Pelo endereço</Selo>
              )}
            </div>
            <MapaDoPonto
              config={mapa.data}
              pontoId={p.id}
              coordenadas={p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : null}
              podeAjustar={p.podeEditar}
            />
          </Cartao>
        </div>

        <Cartao>
          <h2 className="font-titulo text-lg font-bold">
            Vendas neste ponto <span className="text-base font-semibold text-texto-3">({vendas.data?.total ?? "…"})</span>
          </h2>
          {usuario.papel === "revendedor" && <p className="mt-1 text-sm text-texto-2">Aparecem só as vendas feitas por você.</p>}
          {vendas.isError ? (
            <div className="mt-3">
              <ErroCarregar erro={vendas.error} aoTentar={() => vendas.refetch()} />
            </div>
          ) : !vendas.data ? (
            <Carregando />
          ) : vendas.data.vendas.length === 0 ? (
            <div className="mt-3">
              <Vazio titulo="Nenhuma venda registrada aqui" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-2.5">
                {vendas.data.vendas.map((v) => (
                  <CartaoVenda key={v.id} venda={v} slug={slug} mostrarPonto={false} />
                ))}
              </div>
              <Paginacao pagina={vendas.data.pagina} paginas={vendas.data.paginas} hrefBase={`/${slug}/pontos/${p.id}`} />
            </>
          )}
        </Cartao>
      </div>
    </>
  );
}
