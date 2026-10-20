import { Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { formatarDataHora } from "@/compartilhado/formato";
import type { ConfigGoogleMaps } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../../api";
import { Aviso, Carregando, Cartao, ErroCarregar, Selo, TituloPagina, useTitulo } from "../../../componentes/ui";
import { useUsuario } from "../contexto";
import { PassoAPasso } from "./passo-a-passo";
import { TestadorChave } from "./testador";

export default function PaginaGoogleMaps() {
  useTitulo("Google Maps");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const config = useQuery({
    queryKey: chave(slug, "google-maps"),
    queryFn: () => api.get<ConfigGoogleMaps>(daEmpresa(slug, "/google-maps")),
    enabled: usuario.papel === "master",
  });

  if (usuario.papel !== "master") return <Navigate to={`/${slug}/vendas`} replace />;

  const status = config.data?.status ?? "nao_configurada";

  return (
    <>
      <TituloPagina
        titulo="Google Maps"
        descricao="O mapa e a localização dos comércios usam a conta do Google Cloud da sua empresa. A cobrança do Google vai direto para ela."
      />
      {config.isError ? (
        <ErroCarregar erro={config.error} aoTentar={() => config.refetch()} />
      ) : !config.data ? (
        <Carregando />
      ) : (
        <>
          {config.data.provedor === "osm" && (
            <Aviso tipo="info" titulo="Modo de teste: mapa do OpenStreetMap" className="mb-5">
              Este ambiente está usando o OpenStreetMap, que não precisa de chave. A chave do Google abaixo só passa a valer quando o sistema
              for configurado para usar o Google Maps.
            </Aviso>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col gap-5">
              <Cartao>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-titulo text-lg font-bold">Situação</h2>
                  {status === "valida" ? (
                    <Selo tipo="sucesso">Funcionando</Selo>
                  ) : status === "com_erro" ? (
                    <Selo tipo="erro">Com erro</Selo>
                  ) : (
                    <Selo tipo="alerta">Não configurado</Selo>
                  )}
                </div>
                <div className="mt-3 text-sm text-texto-2">
                  {status === "valida" && <p>Chave validada em {formatarDataHora(config.data.validadaEm)}.</p>}
                  {status === "nao_configurada" && (
                    <p>
                      Enquanto não houver chave, o mapa fica desligado e os comércios novos ficam com “localização pendente”. Vendas, pontos e o
                      menu de cidades funcionam normalmente.
                    </p>
                  )}
                  {status === "com_erro" && (
                    <Aviso tipo="erro" titulo="O Google recusou a chave">
                      {config.data.ultimoErro ?? "Teste a chave de novo para ver o motivo."}
                    </Aviso>
                  )}
                </div>
              </Cartao>

              <Cartao>
                <h2 className="mb-4 font-titulo text-lg font-bold">Chave da empresa</h2>
                <TestadorChave slug={slug} chaveAtual={config.data.chave} />
              </Cartao>
            </div>

            <Cartao>
              <h2 className="font-titulo text-lg font-bold">Passo a passo no Google Cloud</h2>
              <p className="mt-1 mb-5 text-sm text-texto-2">Leva uns 15 minutos. A Gabriel Studio pode acompanhar por chamada.</p>
              <PassoAPasso origem={window.location.origin} />
            </Cartao>
          </div>
        </>
      )}
    </>
  );
}
