import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { carregarLeaflet, criarMapa, iconePino, CENTRO_BRASIL_OSM } from "./leaflet";
import type { MarcadorPonto } from "../mapa-vendas";

/** Mapa de vendas com OpenStreetMap: um marcador por ponto, agrupados quando próximos. */
export function MapaVendasOsm({ pontos, aoEscolher }: { pontos: MarcadorPonto[]; aoEscolher: (id: string) => void }) {
  const elemento = useRef<HTMLDivElement>(null);
  const estado = useRef<{ L: typeof Leaflet; mapa: Leaflet.Map; grupo: Leaflet.MarkerClusterGroup } | null>(null);
  const aoEscolherRef = useRef(aoEscolher);
  useEffect(() => {
    aoEscolherRef.current = aoEscolher;
  });

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    let mapa: Leaflet.Map | null = null;
    (async () => {
      const L = await carregarLeaflet(true);
      if (cancelado || !elemento.current) return;
      mapa = criarMapa(L, elemento.current, { center: CENTRO_BRASIL_OSM, zoom: 4 });
      const grupo = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
      mapa.addLayer(grupo);
      estado.current = { L, mapa, grupo };
      desenhar();
    })();
    return () => {
      cancelado = true;
      estado.current = null;
      mapa?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desenhar() {
    const atual = estado.current;
    if (!atual) return;
    const { L, mapa, grupo } = atual;
    grupo.clearLayers();
    pontos.forEach((p) => {
      const marcador = L.marker([p.lat, p.lng], { icon: iconePino(L, p.destacado), title: p.nome, alt: p.nome });
      marcador.on("click", () => aoEscolherRef.current(p.id));
      grupo.addLayer(marcador);
    });
    if (pontos.length > 0) {
      const foco = pontos.some((p) => p.destacado) ? pontos.filter((p) => p.destacado) : pontos;
      const limites = L.latLngBounds(foco.map((p) => [p.lat, p.lng] as [number, number]));
      mapa.fitBounds(limites, { padding: [50, 50], maxZoom: foco.length === 1 ? 15 : 17 });
    }
  }

  // Redesenha quando a lista (ou a cidade em destaque) muda.
  useEffect(() => {
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos]);

  return <div ref={elemento} className="h-full w-full" role="application" aria-label="Mapa de vendas" />;
}
