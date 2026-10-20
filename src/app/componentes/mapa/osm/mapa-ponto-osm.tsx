import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { carregarLeaflet, criarMapa, iconePino } from "./leaflet";

type Coordenadas = { lat: number; lng: number };
export type ResumoMarcador = { titulo: string; linhas: string[] };

/** Monta o conteúdo do balão com textContent (os textos vêm do banco: nada de HTML cru). */
function conteudoBalao(resumo: ResumoMarcador) {
  const caixa = document.createElement("div");
  caixa.style.cssText = "min-width:180px;font:14px/1.45 var(--font-sans, sans-serif)";
  const titulo = document.createElement("strong");
  titulo.textContent = resumo.titulo;
  titulo.style.cssText = "display:block;margin-bottom:4px;font-size:15px";
  caixa.appendChild(titulo);
  for (const linha of resumo.linhas) {
    const item = document.createElement("div");
    item.textContent = linha;
    caixa.appendChild(item);
  }
  return caixa;
}

/** Mapa pequeno de um ponto (OpenStreetMap). Quem pode editar arrasta o pino. */
export function MapaPontoOsm({
  coordenadas,
  podeAjustar,
  aoArrastar,
  resumo,
}: {
  coordenadas: Coordenadas;
  podeAjustar: boolean;
  aoArrastar: (ponto: Coordenadas) => void;
  /** Se informado, tocar no marcador abre um balão com estas informações. */
  resumo?: ResumoMarcador;
}) {
  const elemento = useRef<HTMLDivElement>(null);
  const aoArrastarRef = useRef(aoArrastar);
  useEffect(() => {
    aoArrastarRef.current = aoArrastar;
  });

  useEffect(() => {
    let cancelado = false;
    let mapa: Leaflet.Map | null = null;
    (async () => {
      const L = await carregarLeaflet();
      if (cancelado || !elemento.current) return;
      mapa = criarMapa(L, elemento.current, { center: [coordenadas.lat, coordenadas.lng], zoom: 16, scrollWheelZoom: false });
      const marcador = L.marker([coordenadas.lat, coordenadas.lng], { icon: iconePino(L), draggable: podeAjustar }).addTo(mapa);
      marcador.on("dragend", () => {
        const p = marcador.getLatLng();
        aoArrastarRef.current({ lat: p.lat, lng: p.lng });
      });
      if (resumo) marcador.bindPopup(conteudoBalao(resumo), { offset: [0, -30] });
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordenadas.lat, coordenadas.lng, podeAjustar]);

  return <div ref={elemento} className="h-full w-full" />;
}
