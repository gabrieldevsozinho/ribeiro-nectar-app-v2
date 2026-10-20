import { lazy } from "react";
import { Navigate, Outlet, ScrollRestoration, type RouteObject } from "react-router";
import PaginaInicial from "./paginas/inicio";
import NaoEncontrado from "./paginas/nao-encontrado";
import LayoutEmpresa from "./paginas/empresa/layout";
import PaginaLogin from "./paginas/empresa/login";
import PaginaPrimeiroAcesso from "./paginas/empresa/primeiro-acesso";
import PaginaVendas from "./paginas/empresa/vendas/lista";
import LayoutAdmin from "./paginas/admin/layout";
import PaginaLoginAdmin from "./paginas/admin/login";

// Telas carregadas sob demanda: as de mapa trazem as bibliotecas do Google Maps e do Leaflet.
const PaginaNovaVenda = lazy(() => import("./paginas/empresa/vendas/nova"));
const PaginaVenda = lazy(() => import("./paginas/empresa/vendas/detalhe"));
const PaginaMapa = lazy(() => import("./paginas/empresa/mapa"));
const PaginaPontos = lazy(() => import("./paginas/empresa/pontos/lista"));
const PaginaNovoPonto = lazy(() => import("./paginas/empresa/pontos/novo"));
const PaginaPonto = lazy(() => import("./paginas/empresa/pontos/detalhe"));
const PaginaEditarPonto = lazy(() => import("./paginas/empresa/pontos/editar"));
const PaginaProdutos = lazy(() => import("./paginas/empresa/produtos"));
const PaginaRevendedores = lazy(() => import("./paginas/empresa/revendedores/lista"));
const PaginaNovoRevendedor = lazy(() => import("./paginas/empresa/revendedores/novo"));
const PaginaRevendedor = lazy(() => import("./paginas/empresa/revendedores/detalhe"));
const PaginaGoogleMaps = lazy(() => import("./paginas/empresa/google-maps/pagina"));
const PaginaPerfil = lazy(() => import("./paginas/empresa/perfil"));
const PaginaEmpresas = lazy(() => import("./paginas/admin/empresas"));
const PaginaNovaEmpresa = lazy(() => import("./paginas/admin/nova-empresa"));
const PaginaEmpresa = lazy(() => import("./paginas/admin/empresa"));

function Raiz() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

/**
 * Endereços (iguais aos do projeto original):
 *   /admin/...                  painel da plataforma
 *   /:slug/login, /:slug/...    área de cada empresa (ex.: /apiario-exemplo/vendas)
 */
export const rotas: RouteObject[] = [
  {
    element: <Raiz />,
    children: [
      { index: true, element: <PaginaInicial /> },

      { path: "admin/login", element: <PaginaLoginAdmin /> },
      {
        path: "admin",
        element: <LayoutAdmin />,
        children: [
          { index: true, element: <Navigate to="/admin/empresas" replace /> },
          { path: "empresas", element: <PaginaEmpresas /> },
          { path: "empresas/nova", element: <PaginaNovaEmpresa /> },
          { path: "empresas/:id", element: <PaginaEmpresa /> },
        ],
      },

      { path: ":slug/login", element: <PaginaLogin /> },
      { path: ":slug/primeiro-acesso", element: <PaginaPrimeiroAcesso /> },
      {
        path: ":slug",
        element: <LayoutEmpresa />,
        children: [
          { index: true, element: <Navigate to="vendas" replace /> },
          { path: "vendas", element: <PaginaVendas /> },
          { path: "vendas/nova", element: <PaginaNovaVenda /> },
          { path: "vendas/:id", element: <PaginaVenda /> },
          { path: "mapa", element: <PaginaMapa /> },
          { path: "pontos", element: <PaginaPontos /> },
          { path: "pontos/novo", element: <PaginaNovoPonto /> },
          { path: "pontos/:id", element: <PaginaPonto /> },
          { path: "pontos/:id/editar", element: <PaginaEditarPonto /> },
          { path: "produtos", element: <PaginaProdutos /> },
          { path: "revendedores", element: <PaginaRevendedores /> },
          { path: "revendedores/novo", element: <PaginaNovoRevendedor /> },
          { path: "revendedores/:id", element: <PaginaRevendedor /> },
          { path: "configuracoes/google-maps", element: <PaginaGoogleMaps /> },
          { path: "perfil", element: <PaginaPerfil /> },
        ],
      },

      { path: "*", element: <NaoEncontrado /> },
    ],
  },
];
