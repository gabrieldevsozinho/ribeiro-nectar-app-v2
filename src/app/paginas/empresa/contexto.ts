import { useQuery } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router";
import type { ConfigMapaCliente, UsuarioLogado } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../api";

export type UsuarioDaEmpresa = UsuarioLogado & { empresa: NonNullable<UsuarioLogado["empresa"]> };

/** Usuário logado na área da empresa (carregado pelo layout, que só mostra a página depois disso). */
export function useUsuario() {
  return useOutletContext<UsuarioDaEmpresa>();
}

/** Endereço da empresa na URL (/:slug/...). */
export function useSlug() {
  return useParams().slug ?? "";
}

/** Configuração do mapa (provedor e chave da empresa). */
export function useConfigMapa(slug: string) {
  return useQuery({
    queryKey: chave(slug, "config-mapa"),
    queryFn: () => api.get<ConfigMapaCliente>(daEmpresa(slug, "/config-mapa")),
    staleTime: 60_000,
  });
}
