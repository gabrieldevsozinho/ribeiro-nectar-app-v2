import { useState, useTransition } from "react";
import { AdvancedMarker, InfoWindow, Map, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { Aviso } from "../../../componentes/ui";
import { ProvedorMapa, type ConfigMapaCliente } from "../../../componentes/mapa/provedor-mapa";
import { ID_MAPA, type Coordenadas } from "../../../componentes/mapa/seletor-localizacao";
import { MapaPontoOsm, type ResumoMarcador } from "../../../componentes/mapa/osm/mapa-ponto-osm";
import { definirLocalizacao } from "../../../chamadas";

/** Mapa pequeno do ponto. Quem pode editar arrasta o pino para ajustar. */
export function MapaDoPonto({
  config,
  pontoId,
  coordenadas,
  podeAjustar,
  resumo,
  textoSemLocalizacao,
  altura = "h-56",
}: {
  config: ConfigMapaCliente;
  pontoId: string;
  coordenadas: Coordenadas | null;
  podeAjustar: boolean;
  /** Tocar no marcador mostra estas informações (usado na página da venda). */
  resumo?: ResumoMarcador;
  textoSemLocalizacao?: string;
  altura?: string;
}) {
  const [salvando, iniciar] = useTransition();
  const [salvo, setSalvo] = useState(false);

  if (!coordenadas) {
    return (
      <p className="text-sm text-texto-2">
        Este ponto ainda não tem localização.{" "}
        {textoSemLocalizacao ??
          (podeAjustar ? "Use “Editar” para localizar o endereço no mapa." : "O master ou quem cadastrou pode localizá-lo.")}
      </p>
    );
  }

  return (
    <ProvedorMapa config={config} altura={altura}>
      <div className={`${altura} overflow-hidden rounded-xl border border-borda`}>
        {config.provedor === "osm" ? (
          <MapaPontoOsm
            coordenadas={coordenadas}
            podeAjustar={podeAjustar}
            resumo={resumo}
            aoArrastar={(p) =>
              iniciar(async () => {
                const r = await definirLocalizacao(config.slug, pontoId, p.lat, p.lng, "ajustada");
                setSalvo(r.ok);
              })
            }
          />
        ) : (
        <Map mapId={ID_MAPA} defaultCenter={coordenadas} defaultZoom={16} gestureHandling="cooperative" disableDefaultUI zoomControl>
          <MarcadorGoogle
            coordenadas={coordenadas}
            podeAjustar={podeAjustar}
            resumo={resumo}
            aoArrastar={(lat, lng) =>
              iniciar(async () => {
                const r = await definirLocalizacao(config.slug, pontoId, lat, lng, "ajustada");
                setSalvo(r.ok);
              })
            }
          />
        </Map>
        )}
      </div>
      {podeAjustar && <p className="mt-2 text-xs text-texto-3">Arraste o pino para corrigir a posição.</p>}
      {salvando && <p className="mt-1 text-xs text-texto-2">Salvando posição…</p>}
      {salvo && !salvando && <Aviso tipo="sucesso" className="mt-2">Posição ajustada.</Aviso>}
    </ProvedorMapa>
  );
}

function MarcadorGoogle({
  coordenadas,
  podeAjustar,
  resumo,
  aoArrastar,
}: {
  coordenadas: Coordenadas;
  podeAjustar: boolean;
  resumo?: ResumoMarcador;
  aoArrastar: (lat: number, lng: number) => void;
}) {
  const [referencia, marcador] = useAdvancedMarkerRef();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <AdvancedMarker
        ref={referencia}
        position={coordenadas}
        draggable={podeAjustar}
        onClick={() => resumo && setAberto((a) => !a)}
        onDragEnd={(e) => {
          const ponto = e.latLng;
          if (ponto) aoArrastar(ponto.lat(), ponto.lng());
        }}
      />
      {aberto && resumo && (
        <InfoWindow anchor={marcador} onClose={() => setAberto(false)} headerContent={<strong>{resumo.titulo}</strong>}>
          {resumo.linhas.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </InfoWindow>
      )}
    </>
  );
}
