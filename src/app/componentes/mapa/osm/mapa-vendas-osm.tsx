import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { piorSituacao, type Situacao } from "@/compartilhado/semaforo";
import { carregarLeaflet, criarMapa, iconeGrupo, iconePino, marcadorMinhaPosicao, CENTRO_BRASIL_OSM } from "./leaflet";
import type { PropsMapaVendas } from "../mapa-vendas";

type Estado = { L: typeof Leaflet; mapa: Leaflet.Map; grupo: Leaflet.MarkerClusterGroup; eu: Leaflet.LayerGroup };
type OpcoesPino = Leaflet.MarkerOptions & { situacao: Situacao | null };

/** Mapa de vendas com OpenStreetMap: um pino por comércio, na cor da situação, agrupados quando próximos. */
export function MapaVendasOsm({ pontos, minhaPosicao, enquadramento, foco, aoEscolher }: PropsMapaVendas) {
  const elemento = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const marcadores = useRef(new Map<string, Leaflet.Marker>());
  const atuais = useRef({ pontos, minhaPosicao, aoEscolher });
  useEffect(() => {
    atuais.current = { pontos, minhaPosicao, aoEscolher };
  });

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    let mapa: Leaflet.Map | null = null;
    (async () => {
      const L = await carregarLeaflet(true);
      if (cancelado || !elemento.current) return;
      mapa = criarMapa(L, elemento.current, { center: CENTRO_BRASIL_OSM, zoom: 4 });
      const grupo = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        // Dentro da cidade, cada comércio aparece no seu pino.
        disableClusteringAtZoom: 15,
        iconCreateFunction: (cluster) =>
          iconeGrupo(
            L,
            cluster.getChildCount(),
            piorSituacao(cluster.getAllChildMarkers().map((m) => (m.options as OpcoesPino).situacao ?? null)),
          ),
      });
      mapa.addLayer(grupo);
      const eu = L.layerGroup().addTo(mapa);
      setEstado({ L, mapa, grupo, eu });
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, []);

  // Pinos (redesenhados quando a lista, a cor ou o escolhido mudam).
  useEffect(() => {
    if (!estado) return;
    const { L, grupo } = estado;
    grupo.clearLayers();
    marcadores.current.clear();
    for (const p of pontos) {
      const opcoes: OpcoesPino = {
        icon: iconePino(L, p.selecionado, p.situacao),
        title: p.nome,
        alt: p.nome,
        situacao: p.situacao,
        zIndexOffset: p.selecionado ? 1000 : 0,
      };
      const marcador = L.marker([p.lat, p.lng], opcoes);
      marcador.on("click", () => atuais.current.aoEscolher(p.id));
      grupo.addLayer(marcador);
      marcadores.current.set(p.id, marcador);
    }
  }, [estado, pontos]);

  // "Você está aqui"
  useEffect(() => {
    if (!estado) return;
    estado.eu.clearLayers();
    if (minhaPosicao) marcadorMinhaPosicao(estado.L, minhaPosicao).addTo(estado.eu);
  }, [estado, minhaPosicao]);

  // Enquadra os pinos (e a posição de quem está usando) quando muda a cidade, o filtro ou o "Estou aqui".
  useEffect(() => {
    if (!estado) return;
    const { pontos: lista, minhaPosicao: eu } = atuais.current;
    const coordenadas: [number, number][] = lista.map((p) => [p.lat, p.lng]);
    if (eu) coordenadas.push([eu.lat, eu.lng]);
    if (coordenadas.length === 0) return;
    if (coordenadas.length === 1) estado.mapa.setView(coordenadas[0]!, 15);
    else estado.mapa.fitBounds(estado.L.latLngBounds(coordenadas), { padding: [40, 40], maxZoom: 16 });
  }, [estado, enquadramento]);

  // Comércio escolhido na lista: o mapa vai até ele.
  useEffect(() => {
    if (!estado || !foco) return;
    const marcador = marcadores.current.get(foco);
    if (marcador) estado.mapa.setView(marcador.getLatLng(), Math.max(estado.mapa.getZoom(), 16));
  }, [estado, foco]);

  return <div ref={elemento} className="h-full w-full" role="application" aria-label="Mapa de vendas" />;
}
