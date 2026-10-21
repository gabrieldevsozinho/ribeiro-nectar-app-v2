import type * as Leaflet from "leaflet";
import type { Situacao } from "@/compartilhado/semaforo";
import { COR_PINO } from "../situacao";

export const CENTRO_BRASIL_OSM: [number, number] = [-15.78, -47.93];

/** Carrega o Leaflet só no navegador (ele usa `window` ao ser importado). */
export async function carregarLeaflet(comAgrupamento = false): Promise<typeof Leaflet> {
  const modulo = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  if (!comAgrupamento) return modulo;

  // O plugin de agrupamento acrescenta peças ao `L` global, mas o módulo importado não
  // aceita novas propriedades: ele recebe uma cópia editável.
  const w = window as unknown as { L?: typeof Leaflet };
  if (!w.L || !("markerClusterGroup" in w.L)) {
    w.L = { ...(modulo.default ?? modulo) } as typeof Leaflet;
    await import("leaflet.markercluster");
  }
  await import("leaflet.markercluster/dist/MarkerCluster.css");
  await import("leaflet.markercluster/dist/MarkerCluster.Default.css");
  return w.L!;
}

/** Mapa base: OpenStreetMap. O servidor público é para testes e uso leve (ver README). */
export function criarMapa(L: typeof Leaflet, elemento: HTMLElement, opcoes: Leaflet.MapOptions = {}) {
  const mapa = L.map(elemento, { zoomControl: true, attributionControl: true, ...opcoes });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
  }).addTo(mapa);
  return mapa;
}

/**
 * Pino em formato de gota (sem depender de imagens externas). Por padrão na cor do mel;
 * no mapa de vendas, na cor da situação do comércio (semáforo).
 */
export function iconePino(L: typeof Leaflet, destacado = false, situacao: Situacao | null = null) {
  const cor = situacao ? COR_PINO[situacao] : destacado ? { ...COR_PINO.sem_prazo, fundo: "#c98408" } : COR_PINO.sem_prazo;
  const tamanho = destacado ? 42 : 34;
  return L.divIcon({
    className: "pino-osm",
    html: `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" fill="${cor.fundo}" stroke="${cor.borda}" stroke-width="1.2"/><circle cx="12" cy="10" r="2.6" fill="${cor.miolo}"/></svg>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho],
  });
}

/** Grupo de pinos próximos: mostra quantos são, na cor do pior comércio do grupo. */
export function iconeGrupo(L: typeof Leaflet, quantidade: number, situacao: Situacao | null) {
  const cor = COR_PINO[situacao ?? "sem_prazo"];
  const tamanho = quantidade < 10 ? 36 : quantidade < 100 ? 42 : 48;
  return L.divIcon({
    className: "grupo-pinos-osm",
    html: `<div class="grupo-pinos" style="width:${tamanho}px;height:${tamanho}px;background:${cor.fundo};color:${cor.miolo}">${quantidade}</div>`,
    iconSize: [tamanho, tamanho],
  });
}

/** "Você está aqui": bolinha azul com borda branca. */
export function marcadorMinhaPosicao(L: typeof Leaflet, posicao: { lat: number; lng: number }) {
  return L.circleMarker([posicao.lat, posicao.lng], {
    radius: 9,
    color: "#ffffff",
    weight: 3,
    fillColor: "#1a73e8",
    fillOpacity: 1,
    interactive: false,
  });
}
