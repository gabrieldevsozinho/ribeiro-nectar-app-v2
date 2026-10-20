import { Suspense } from "react";
import { Link, Navigate, Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { StatusGoogleMaps, UsuarioLogado } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../api";
import { MenuApp, MenuEsqueleto, type ItemMenu } from "../../componentes/menu-app";
import {
  IconeAlerta,
  IconeEngrenagem,
  IconeLoja,
  IconeMais,
  IconeMapa,
  IconePessoa,
  IconePessoas,
  IconePote,
  IconeVendas,
} from "../../componentes/icones";
import { Carregando, ErroCarregar } from "../../componentes/ui";
import { useSlug, type UsuarioDaEmpresa } from "./contexto";

/**
 * Moldura da área da empresa. Antes de mostrar qualquer página, confere quem está
 * logado (/eu): sem login, de outra empresa ou com a senha temporária pendente, a API
 * recusa e o usuário é levado para a tela certa (veja tratarErroDeAcesso em api.ts).
 */
export default function LayoutEmpresa() {
  const slug = useSlug();
  const eu = useQuery({
    queryKey: chave(slug, "eu"),
    queryFn: () => api.get<UsuarioLogado>(daEmpresa(slug, "/eu")),
  });
  const usuario = eu.data as UsuarioDaEmpresa | undefined;

  // A troca da senha temporária vem antes de qualquer tela.
  if (usuario?.deveTrocarSenha) return <Navigate to={`/${slug}/primeiro-acesso`} replace />;
  const liberado = usuario && !usuario.deveTrocarSenha;

  return (
    <div className="min-h-dvh md:flex">
      {liberado ? (
        <MenuApp
          itens={itensDoMenu(slug, usuario)}
          titulo={usuario.empresa.nome}
          subtitulo={usuario.papel === "master" ? "Master" : "Revendedor"}
          nomeUsuario={usuario.nome}
          destinoAoSair={`/${slug}/login?motivo=saiu`}
        />
      ) : (
        <MenuEsqueleto />
      )}
      <div className="min-w-0 flex-1">
        {liberado && usuario.papel === "master" && <AvisoGoogleMaps slug={slug} />}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {eu.isError && !(eu.error as { motivo?: string }).motivo ? (
            <ErroCarregar erro={eu.error} aoTentar={() => eu.refetch()} />
          ) : liberado ? (
            <Suspense fallback={<Carregando />}>
              <Outlet context={usuario} />
            </Suspense>
          ) : (
            <Carregando />
          )}
        </main>
      </div>
    </div>
  );
}

function itensDoMenu(slug: string, usuario: UsuarioDaEmpresa): ItemMenu[] {
  const base = `/${slug}`;
  const comuns: ItemMenu[] = [
    { href: `${base}/vendas`, rotulo: usuario.papel === "master" ? "Vendas" : "Minhas vendas", icone: <IconeVendas /> },
    { href: `${base}/vendas/nova`, rotulo: "Nova venda", icone: <IconeMais />, destaque: true },
    { href: `${base}/mapa`, rotulo: "Mapa e cidades", icone: <IconeMapa /> },
    { href: `${base}/pontos`, rotulo: "Pontos de venda", icone: <IconeLoja /> },
    { href: `${base}/produtos`, rotulo: "Produtos", icone: <IconePote /> },
  ];
  if (usuario.papel === "master") {
    comuns.push(
      { href: `${base}/revendedores`, rotulo: "Revendedores", icone: <IconePessoas /> },
      { href: `${base}/configuracoes/google-maps`, rotulo: "Google Maps", icone: <IconeEngrenagem /> },
    );
  }
  comuns.push({ href: `${base}/perfil`, rotulo: "Meu perfil", icone: <IconePessoa /> });
  return comuns;
}

/** Faixa no topo para o master enquanto o Google Maps da empresa não estiver funcionando. */
function AvisoGoogleMaps({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: chave(slug, "aviso-maps"),
    queryFn: () => api.get<{ status: StatusGoogleMaps | null }>(daEmpresa(slug, "/aviso-maps")),
  });
  if (!data?.status) return null;

  const comErro = data.status === "com_erro";
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm md:px-8 ${
        comErro ? "border-erro/25 bg-erro-claro text-erro" : "border-alerta/25 bg-alerta-claro text-alerta"
      }`}
      role="status"
    >
      <IconeAlerta tamanho={18} />
      <span className="font-semibold">
        {comErro ? "O Google Maps da sua empresa parou de funcionar." : "Configure o Google Maps da sua empresa."}
      </span>
      <span className="hidden opacity-90 sm:inline">
        {comErro ? "O mapa está indisponível para todos." : "Sem ele, o mapa e a localização dos pontos ficam desligados."}
      </span>
      <Link to={`/${slug}/configuracoes/google-maps`} className="font-semibold underline underline-offset-2">
        {comErro ? "Ver o problema" : "Configurar agora"}
      </Link>
    </div>
  );
}
