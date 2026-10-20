import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { formatarData } from "@/compartilhado/formato";
import type { EmpresaResumo } from "@/compartilhado/tipos";
import { api } from "../../api";
import { IconeMais, IconeSeta } from "../../componentes/icones";
import { BotaoLink, Carregando, ErroCarregar, Selo, TituloPagina, Vazio, useTitulo } from "../../componentes/ui";
import { SeloGoogleMaps } from "./selo-google-maps";

export default function PaginaEmpresas() {
  useTitulo("Empresas");
  const empresas = useQuery({ queryKey: ["admin", "empresas"], queryFn: () => api.get<EmpresaResumo[]>("/api/admin/empresas") });

  return (
    <>
      <TituloPagina
        titulo="Empresas"
        descricao="Empresas que usam o Ribeiro Néctar. O painel não mostra vendas nem chaves (LGPD)."
        acoes={
          <BotaoLink to="/admin/empresas/nova">
            <IconeMais tamanho={18} /> Nova empresa
          </BotaoLink>
        }
      />
      {empresas.isError ? (
        <ErroCarregar erro={empresas.error} aoTentar={() => empresas.refetch()} />
      ) : !empresas.data ? (
        <Carregando />
      ) : empresas.data.length === 0 ? (
        <Vazio titulo="Nenhuma empresa cadastrada">Cadastre a primeira empresa em “Nova empresa”.</Vazio>
      ) : (
        <ul className="grid gap-3">
          {empresas.data.map((empresa) => (
            <li key={empresa.id}>
              <Link
                to={`/admin/empresas/${empresa.id}`}
                className="flex items-center gap-4 rounded-[var(--radius-cartao)] border border-borda bg-superficie p-4 transition-colors hover:border-borda-forte md:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-texto">{empresa.nome}</span>
                    {!empresa.ativa && <Selo tipo="erro">Desativada</Selo>}
                    <SeloGoogleMaps status={empresa.maps.status} />
                  </div>
                  <p className="mt-1 text-sm text-texto-2">
                    <span className="font-mono">/{empresa.slug}</span> · desde {formatarData(empresa.criadoEm)}
                  </p>
                  <p className="mt-1 text-sm text-texto-2">
                    {empresa.masters}/{empresa.limiteMasters} masters · {empresa.revendedores}/{empresa.limiteRevendedores} revendedores
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
