import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { EnderecoBusca, PrecisaoLocalizacao } from "@/compartilhado/tipos";
import { Aviso, Botao } from "../../ui";
import { geocodificarEndereco } from "../../../chamadas";
import { carregarLeaflet, criarMapa, iconePino, CENTRO_BRASIL_OSM } from "./leaflet";

type Coordenadas = { lat: number; lng: number };

type Props = {
  slug: string;
  coordenadas: Coordenadas | null;
  /** Lê o endereço digitado no formulário, na hora do clique. */
  enderecoBusca: () => EnderecoBusca;
  aoMudar: (coordenadas: Coordenadas, status: "automatica" | "ajustada") => void;
};

/** O que dizer ao usuário conforme o quanto o endereço foi encontrado. */
const AVISO_POR_PRECISAO: Record<Exclude<PrecisaoLocalizacao, "exata">, string> = {
  rua: "Encontramos a rua, mas não o número exato (o OpenStreetMap nem sempre tem os números). Arraste o pino até o comércio.",
  cidade: "Encontramos só a cidade. Dê zoom, e toque no mapa no local do comércio.",
};

/** Localiza o endereço (Nominatim) e deixa ajustar o pino no mapa do OpenStreetMap. */
export function SeletorOsm({ slug, coordenadas, enderecoBusca, aoMudar }: Props) {
  const elemento = useRef<HTMLDivElement>(null);
  const estado = useRef<{ L: typeof Leaflet; mapa: Leaflet.Map; marcador: Leaflet.Marker | null } | null>(null);
  const aoMudarRef = useRef(aoMudar);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    aoMudarRef.current = aoMudar;
  });

  function colocarPino(ponto: Coordenadas, aproximar: boolean) {
    const atual = estado.current;
    if (!atual) return;
    const { L, mapa } = atual;
    if (atual.marcador) {
      atual.marcador.setLatLng([ponto.lat, ponto.lng]);
    } else {
      const marcador = L.marker([ponto.lat, ponto.lng], { icon: iconePino(L), draggable: true });
      marcador.on("dragend", () => {
        const p = marcador.getLatLng();
        aoMudarRef.current({ lat: p.lat, lng: p.lng }, "ajustada");
      });
      marcador.addTo(mapa);
      atual.marcador = marcador;
    }
    if (aproximar) mapa.setView([ponto.lat, ponto.lng], 17);
  }

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    let mapa: Leaflet.Map | null = null;
    (async () => {
      const L = await carregarLeaflet();
      if (cancelado || !elemento.current) return;
      mapa = criarMapa(L, elemento.current, { center: coordenadas ? [coordenadas.lat, coordenadas.lng] : CENTRO_BRASIL_OSM, zoom: coordenadas ? 17 : 4 });
      estado.current = { L, mapa, marcador: null };
      mapa.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const ponto = { lat: e.latlng.lat, lng: e.latlng.lng };
        colocarPino(ponto, false);
        aoMudarRef.current(ponto, "ajustada");
      });
      if (coordenadas) colocarPino(coordenadas, false);
    })();
    return () => {
      cancelado = true;
      estado.current = null;
      mapa?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function localizar() {
    const endereco = enderecoBusca();
    if (!endereco.logradouro.trim() || !endereco.cidade.trim() || !endereco.uf) {
      setAviso("Preencha a rua, a cidade e o estado antes de localizar.");
      return;
    }
    setBuscando(true);
    setAviso(undefined);
    const resultado = await geocodificarEndereco(slug, endereco);
    setBuscando(false);
    if (!resultado.ok) return setAviso("Não foi possível consultar o serviço de endereços agora. Toque no mapa no local do comércio.");
    const achado = resultado.ponto;
    if (!achado) return setAviso("Não encontramos este endereço. Toque no mapa no local do comércio.");

    if (achado.precisao === "cidade") {
      // O centro da cidade não é a localização do comércio: leva o mapa até lá, sem colocar pino.
      estado.current?.mapa.setView([achado.lat, achado.lng], 14);
      return setAviso(AVISO_POR_PRECISAO.cidade);
    }
    colocarPino(achado, true);
    aoMudar(achado, "automatica");
    if (achado.precisao === "rua") setAviso(AVISO_POR_PRECISAO.rua);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" variante="secundario" onClick={localizar} disabled={buscando}>
          {buscando ? "Localizando…" : coordenadas ? "Localizar de novo" : "Localizar no mapa"}
        </Botao>
        <span className="text-sm text-texto-2">
          {coordenadas ? "Arraste o pino ou toque no mapa para ajustar." : "Opcional: sem localização, o ponto fica pendente."}
        </span>
      </div>
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
      <div className="h-72 overflow-hidden rounded-[var(--radius-cartao)] border border-borda">
        <div ref={elemento} className="h-full w-full" />
      </div>
    </div>
  );
}
