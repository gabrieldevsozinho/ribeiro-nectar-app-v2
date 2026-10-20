import { Link, Navigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { formatarData, formatarMoeda } from "@/compartilhado/formato";
import type { ListaRevendedores } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../../api";
import { IconeMais, IconeSeta } from "../../../componentes/icones";
import { Aviso, BotaoLink, Carregando, ErroCarregar, Selo, TituloPagina, Vazio, useTitulo } from "../../../componentes/ui";
import { useUsuario } from "../contexto";

export default function PaginaRevendedores() {
  useTitulo("Revendedores");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const excluido = useSearchParams()[0].get("excluido");
  const lista = useQuery({
    queryKey: chave(slug, "revendedores"),
    queryFn: () => api.get<ListaRevendedores>(daEmpresa(slug, "/revendedores")),
    enabled: usuario.papel === "master",
  });

  if (usuario.papel !== "master") return <Navigate to={`/${slug}/vendas`} replace />;
  if (lista.isError) return <ErroCarregar erro={lista.error} aoTentar={() => lista.refetch()} />;
  if (!lista.data) {
    return (
      <>
        <TituloPagina titulo="Revendedores" />
        <Carregando />
      </>
    );
  }

  const { revendedores, limite } = lista.data;
  const total = revendedores.length;
  const noLimite = total >= limite;

  return (
    <>
      <TituloPagina
        titulo="Revendedores"
        descricao={`${total} de ${limite} do seu plano.`}
        acoes={
          !noLimite && (
            <BotaoLink to={`/${slug}/revendedores/novo`}>
              <IconeMais tamanho={18} /> Cadastrar revendedor
            </BotaoLink>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {excluido && (
          <Aviso tipo="sucesso" titulo="Revendedor excluído">
            O login foi apagado e os dados pessoais foram removidos. As vendas dele continuam no histórico.
          </Aviso>
        )}
        {noLimite && (
          <Aviso tipo="alerta" titulo="Limite do plano atingido">
            Para cadastrar mais revendedores, fale com a Gabriel Studio para ampliar o plano.
          </Aviso>
        )}

        {total === 0 ? (
          <Vazio titulo="Nenhum revendedor cadastrado">Cadastre o primeiro em “Cadastrar revendedor”.</Vazio>
        ) : (
          <ul className="grid gap-3">
            {revendedores.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/${slug}/revendedores/${r.id}`}
                  className="flex items-center gap-4 rounded-[var(--radius-cartao)] border border-borda bg-superficie p-4 transition-colors hover:border-borda-forte"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.nome}</span>
                      {r.bloqueado && <Selo tipo="erro">Bloqueado</Selo>}
                      {r.deveTrocarSenha && <Selo tipo="alerta">Primeiro acesso pendente</Selo>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-texto-2">
                      {r.email}
                      {r.telefone && ` · ${r.telefone}`}
                    </p>
                    <p className="mt-1 text-sm text-texto-2">
                      {r.resumo ? (
                        <>
                          {r.resumo.vendas} vendas · {formatarMoeda(r.resumo.valorTotal)} · última em {formatarData(r.resumo.ultimaVenda)}
                        </>
                      ) : (
                        "Nenhuma venda ainda"
                      )}
                    </p>
                  </div>
                  <IconeSeta className="shrink-0 text-texto-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
