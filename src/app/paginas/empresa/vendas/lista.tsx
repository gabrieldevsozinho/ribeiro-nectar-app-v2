import { Link, useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatarMoeda } from "@/compartilhado/formato";
import type { FiltrosVendasDisponiveis, ListaVendas } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../../api";
import { IconeMais } from "../../../componentes/icones";
import { Paginacao } from "../../../componentes/paginacao";
import { BotaoLink, Carregando, Cartao, ErroCarregar, TituloPagina, Vazio, useTitulo } from "../../../componentes/ui";
import { CartaoVenda } from "../../../componentes/vendas/cartao-venda";
import { useUsuario } from "../contexto";

export default function PaginaVendas() {
  useTitulo("Vendas");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const ehMaster = usuario.papel === "master";
  const navegar = useNavigate();
  const [busca] = useSearchParams();

  const filtros = {
    de: busca.get("de") ?? undefined,
    ate: busca.get("ate") ?? undefined,
    vendedor: ehMaster ? (busca.get("vendedor") ?? undefined) : undefined,
    cidade: busca.get("cidade") ?? undefined,
  };
  const pagina = Number(busca.get("pagina")) || 1;
  const parametros = new URLSearchParams(Object.entries({ ...filtros, pagina: String(pagina) }).filter((e): e is [string, string] => Boolean(e[1])));

  const lista = useQuery({
    queryKey: chave(slug, "vendas", "lista", parametros.toString()),
    queryFn: () => api.get<ListaVendas>(daEmpresa(slug, `/vendas?${parametros}`)),
    placeholderData: keepPreviousData,
  });
  const opcoes = useQuery({
    queryKey: chave(slug, "vendas", "filtros"),
    queryFn: () => api.get<FiltrosVendasDisponiveis>(daEmpresa(slug, "/vendas/filtros")),
  });

  const filtrando = Boolean(filtros.de || filtros.ate || filtros.vendedor || filtros.cidade);
  const campo = "min-h-11 w-full rounded-xl border border-borda-forte bg-superficie px-3 text-base focus:border-mel md:text-[15px]";
  const resultado = lista.data;

  return (
    <>
      <TituloPagina
        titulo={ehMaster ? "Vendas" : "Minhas vendas"}
        descricao={ehMaster ? "Vendas dos revendedores, as suas e as dos masters que compartilham." : "Todas as vendas que você registrou."}
        acoes={
          <BotaoLink to={`/${slug}/vendas/nova`}>
            <IconeMais tamanho={18} /> Nova venda
          </BotaoLink>
        }
      />

      <Cartao className="mb-5">
        <form
          // A key muda quando a URL muda: o formulário mostra sempre os filtros aplicados.
          key={busca.toString()}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
          onSubmit={(evento) => {
            evento.preventDefault();
            const novos = new URLSearchParams();
            for (const [nome, valor] of new FormData(evento.currentTarget)) if (valor) novos.set(nome, String(valor));
            navegar(`/${slug}/vendas${novos.size ? `?${novos}` : ""}`);
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold">
            De
            <input type="date" name="de" defaultValue={filtros.de} className={campo} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Até
            <input type="date" name="ate" defaultValue={filtros.ate} className={campo} />
          </label>
          {ehMaster && (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Vendedor
              <select name="vendedor" defaultValue={filtros.vendedor ?? ""} className={campo}>
                <option value="">Todos</option>
                {(opcoes.data?.vendedores ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Cidade
            <select name="cidade" defaultValue={filtros.cidade ?? ""} className={campo}>
              <option value="">Todas</option>
              {(opcoes.data?.cidades ?? []).map((c) => (
                <option key={`${c.cidade}|${c.uf}`} value={`${c.cidade}|${c.uf}`}>
                  {c.cidade}/{c.uf}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-xl bg-mel px-4 font-semibold text-sobre-mel hover:bg-mel-forte">Filtrar</button>
            {filtrando && (
              <Link to={`/${slug}/vendas`} className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-texto-2 hover:bg-superficie-2">
                Limpar
              </Link>
            )}
          </div>
        </form>
      </Cartao>

      {lista.isError ? (
        <ErroCarregar erro={lista.error} aoTentar={() => lista.refetch()} />
      ) : !resultado ? (
        <Carregando />
      ) : (
        <>
          <p className="mb-3 text-sm text-texto-2">
            <strong className="text-texto">{resultado.total}</strong> {resultado.total === 1 ? "venda" : "vendas"} ·{" "}
            <strong className="text-texto">{formatarMoeda(resultado.soma)}</strong>
            {filtrando && " no filtro"}
          </p>

          {resultado.vendas.length === 0 ? (
            <Vazio titulo={filtrando ? "Nenhuma venda neste filtro" : "Nenhuma venda registrada"}>
              {!filtrando && "Registre a primeira em “Nova venda”."}
            </Vazio>
          ) : (
            <>
              <div className="grid gap-2.5">
                {resultado.vendas.map((v) => (
                  <CartaoVenda key={v.id} venda={v} slug={slug} />
                ))}
              </div>
              <Paginacao pagina={resultado.pagina} paginas={resultado.paginas} hrefBase={`/${slug}/vendas`} filtros={filtros} />
            </>
          )}
        </>
      )}
    </>
  );
}
