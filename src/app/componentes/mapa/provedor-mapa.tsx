import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { APILoadingStatus, APIProvider, useApiLoadingStatus } from "@vis.gl/react-google-maps";
import type { ConfigMapaCliente } from "@/compartilhado/tipos";
import { reportarFalhaMaps } from "../../chamadas";

export type { ConfigMapaCliente };

/** Carrega o Google Maps com a chave da empresa. Sem chave (ou se o Google recusar), mostra o aviso. */
export function ProvedorMapa({ config, children, altura = "h-80" }: { config: ConfigMapaCliente; children: ReactNode; altura?: string }) {
  // OpenStreetMap não precisa de chave nem de carregamento externo de API.
  if (config.provedor === "osm") return <>{children}</>;
  if (!config.chave) return <MapaIndisponivel config={config} motivo="sem_chave" altura={altura} />;

  return (
    <APIProvider apiKey={config.chave} language="pt-BR" region="BR">
      <ConteudoMonitorado config={config} altura={altura}>
        {children}
      </ConteudoMonitorado>
    </APIProvider>
  );
}

function ConteudoMonitorado({ config, children, altura }: { config: ConfigMapaCliente; children: ReactNode; altura: string }) {
  const status = useApiLoadingStatus();
  const reportado = useRef(false);

  useEffect(() => {
    // A chave da empresa parou de funcionar: avisa o sistema (os masters veem a faixa no topo).
    if (status === APILoadingStatus.AUTH_FAILURE && config.origem === "empresa" && !reportado.current) {
      reportado.current = true;
      void reportarFalhaMaps(config.slug, { ok: false, codigo: "FalhaAutenticacao" });
    }
  }, [status, config.origem, config.slug]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return <MapaIndisponivel config={config} motivo="falha" altura={altura} />;
  }

  return (
    <>
      {config.origem === "dev" && (
        <p className="mb-2 text-xs font-semibold text-alerta">Usando a chave de desenvolvimento (só no ambiente local).</p>
      )}
      {children}
    </>
  );
}

export function MapaIndisponivel({
  config,
  motivo,
  altura = "h-80",
}: {
  config: ConfigMapaCliente;
  motivo: "sem_chave" | "falha";
  altura?: string;
}) {
  return (
    <div
      className={`flex ${altura} flex-col items-center justify-center gap-2 rounded-[var(--radius-cartao)] border border-dashed border-borda-forte bg-superficie-2 px-6 text-center`}
    >
      <p className="font-semibold">Mapa indisponível</p>
      <p className="max-w-sm text-sm text-texto-2">
        {config.ehMaster
          ? motivo === "sem_chave"
            ? "Configure o Google Maps da sua empresa para ver o mapa e localizar os comércios."
            : "O Google recusou a chave da sua empresa. Veja o motivo na configuração."
          : "O mapa está desligado no momento. Avise o responsável da sua empresa."}
      </p>
      {config.ehMaster && (
        <Link
          to={`/${config.slug}/configuracoes/google-maps`}
          className="mt-1 text-sm font-semibold text-mel-texto underline underline-offset-2"
        >
          {motivo === "sem_chave" ? "Configurar Google Maps" : "Ver o problema"}
        </Link>
      )}
    </div>
  );
}
