import { useCallback, useEffect, useMemo, useState } from "react";
import { AdvancedMarker, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { MarkerClusterer, type Marker } from "@googlemaps/markerclusterer";
import { CENTRO_BRASIL, ID_MAPA } from "./seletor-localizacao";

export type MarcadorPonto = { id: string; nome: string; lat: number; lng: number; destacado: boolean };

/** Mapa com um marcador por ponto de venda; marcadores próximos se agrupam. */
export function MapaVendas({ pontos, aoEscolher }: { pontos: MarcadorPonto[]; aoEscolher: (id: string) => void }) {
  return (
    <Map
      id="mapa-vendas"
      mapId={ID_MAPA}
      defaultCenter={CENTRO_BRASIL}
      defaultZoom={4}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      fullscreenControl
      className="h-full w-full"
    >
      <Marcadores pontos={pontos} aoEscolher={aoEscolher} />
    </Map>
  );
}

function Marcadores({ pontos, aoEscolher }: { pontos: MarcadorPonto[]; aoEscolher: (id: string) => void }) {
  const mapa = useMap("mapa-vendas");
  const [marcadores, setMarcadores] = useState<Record<string, Marker>>({});
  const agrupador = useMemo(() => (mapa ? new MarkerClusterer({ map: mapa }) : null), [mapa]);

  // Enquadra os pontos (ou a cidade escolhida) sempre que a lista muda.
  useEffect(() => {
    if (!mapa || pontos.length === 0) return;
    const limites = new google.maps.LatLngBounds();
    const foco = pontos.some((p) => p.destacado) ? pontos.filter((p) => p.destacado) : pontos;
    foco.forEach((p) => limites.extend(p));
    mapa.fitBounds(limites, 60);
    if (foco.length === 1) mapa.setZoom(15);
  }, [mapa, pontos]);

  useEffect(() => {
    if (!agrupador) return;
    agrupador.clearMarkers();
    agrupador.addMarkers(Object.values(marcadores));
  }, [agrupador, marcadores]);

  const registrar = useCallback((marcador: Marker | null, id: string) => {
    setMarcadores((atuais) => {
      if ((marcador && atuais[id] === marcador) || (!marcador && !atuais[id])) return atuais;
      if (marcador) return { ...atuais, [id]: marcador };
      const resto = { ...atuais };
      delete resto[id];
      return resto;
    });
  }, []);

  return (
    <>
      {pontos.map((p) => (
        <AdvancedMarker
          key={p.id}
          position={p}
          title={p.nome}
          ref={(marcador) => registrar(marcador, p.id)}
          onClick={() => aoEscolher(p.id)}
        >
          <Pin
            background={p.destacado ? "#c98408" : "#e29a12"}
            borderColor="#7a4a00"
            glyphColor="#2a1a00"
            scale={p.destacado ? 1.15 : 1}
          />
        </AdvancedMarker>
      ))}
    </>
  );
}
