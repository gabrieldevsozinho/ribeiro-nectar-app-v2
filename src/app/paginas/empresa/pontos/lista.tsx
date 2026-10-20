import { Link, useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ListaPontos } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../../api";
import { IconeMais, IconeSeta } from "../../../componentes/icones";
import { LocalizarPendentes } from "../../../componentes/mapa/localizar-pendentes";
import { BotaoLink, Carregando, ErroCarregar, Selo, TituloPagina, Vazio, useTitulo } from "../../../componentes/ui";
import { useConfigMapa, useUsuario } from "../contexto";

export default function PaginaPontos() {
  useTitulo("Pontos de venda");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const navegar = useNavigate();
  const termo = (useSearchParams()[0].get("q") ?? "").trim().slice(0, 60);

  const lista = useQuery({
    queryKey: chave(slug, "pontos", "lista", termo),
    queryFn: () => api.get<ListaPontos>(daEmpresa(slug, `/pontos?q=${encodeURIComponent(termo)}`)),
    placeholderData: keepPreviousData,
  });
  const mapa = useConfigMapa(slug);
  const pontos = lista.data?.pontos;

  return (
    <>
      <TituloPagina
        titulo="Pontos de venda"
        descricao="Os comércios atendidos pela empresa."
        acoes={
          <BotaoLink to={`/${slug}/pontos/novo`}>
            <IconeMais tamanho={18} /> Cadastrar ponto
          </BotaoLink>
        }
      />

      <form
        key={termo}
        className="mb-4 flex gap-2"
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          const q = String(new FormData(evento.currentTarget).get("q") ?? "").trim();
          navegar(q ? `/${slug}/pontos?q=${encodeURIComponent(q)}` : `/${slug}/pontos`);
        }}
      >
        <input
          name="q"
          defaultValue={termo}
          placeholder="Buscar por nome, cidade ou bairro"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-borda-forte bg-superficie px-3.5 text-base focus:border-mel md:text-[15px]"
        />
        <button className="min-h-11 rounded-xl border border-borda-forte px-4 font-semibold hover:bg-superficie-2">Buscar</button>
      </form>

      {usuario.papel === "master" && (lista.data?.pendentes ?? 0) > 0 && mapa.data?.disponivel && (
        <div className="mb-4">
          <LocalizarPendentes config={mapa.data} />
        </div>
      )}

      {lista.isError ? (
        <ErroCarregar erro={lista.error} aoTentar={() => lista.refetch()} />
      ) : !pontos ? (
        <Carregando />
      ) : pontos.length === 0 ? (
        <Vazio titulo={termo ? "Nenhum ponto encontrado" : "Nenhum ponto cadastrado"}>
          {termo ? "Tente outro nome ou cidade." : "Cadastre o primeiro comércio em “Cadastrar ponto”."}
        </Vazio>
      ) : (
        <ul className="grid gap-2.5">
          {pontos.map((p) => (
            <li key={p.id}>
              <Link
                to={`/${slug}/pontos/${p.id}`}
                className="flex items-center gap-4 rounded-[var(--radius-cartao)] border border-borda bg-superficie px-4 py-3.5 transition-colors hover:border-borda-forte"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.nome}</span>
                    {p.localizacaoStatus === "pendente" && <Selo tipo="alerta">Localização pendente</Selo>}
                  </div>
                  <p className="truncate text-sm text-texto-2">
                    {[p.logradouro, p.numero].filter(Boolean).join(", ")}
                    {p.bairro && ` · ${p.bairro}`} · {p.cidade}/{p.uf}
                  </p>
                </div>
                <IconeSeta className="shrink-0 text-texto-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
