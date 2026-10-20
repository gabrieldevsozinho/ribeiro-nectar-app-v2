import { Suspense } from "react";
import { Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { UsuarioLogado } from "@/compartilhado/tipos";
import { api } from "../../api";
import { IconePredio } from "../../componentes/icones";
import { MenuApp } from "../../componentes/menu-app";
import { Carregando } from "../../componentes/ui";

/**
 * Moldura do painel da plataforma. A lista de empresas já exige o admin na API;
 * aqui só se usa o nome para o menu (sem login, a API manda para /admin/login).
 */
export default function LayoutAdmin() {
  const sessao = useQuery({
    queryKey: ["sessao"],
    queryFn: () => api.get<{ estado: string; usuario?: UsuarioLogado }>("/api/sessao"),
  });
  const admin = sessao.data?.usuario?.papel === "admin_plataforma" ? sessao.data.usuario : null;

  return (
    <div className="min-h-dvh md:flex">
      {admin ? (
        <MenuApp
          itens={[{ href: "/admin/empresas", rotulo: "Empresas", icone: <IconePredio /> }]}
          titulo="Plataforma"
          subtitulo="Gabriel Studio"
          nomeUsuario={admin.nome}
          destinoAoSair="/admin/login?motivo=saiu"
        />
      ) : (
        <aside className="hidden h-dvh w-64 shrink-0 border-r border-borda bg-superficie md:block" />
      )}
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={<Carregando />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
