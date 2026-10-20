import { useState } from "react";
import { AdvancedMarker, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Aviso, Botao } from "../ui";
import { reportarFalhaMaps } from "../../chamadas";

export type Coordenadas = { lat: number; lng: number };

// Mapa de demonstração do Google, aceito por qualquer chave (necessário para o marcador moderno).
export const ID_MAPA = "DEMO_MAP_ID";
export const CENTRO_BRASIL: Coordenadas = { lat: -15.78, lng: -47.93 };

type Props = {
  slug: string;
  coordenadas: Coordenadas | null;
  /** Monta o endereço digitado no formulário, na hora do clique. */
  enderecoAtual: () => string;
  aoMudar: (coordenadas: Coordenadas, status: "automatica" | "ajustada") => void;
};

/** Localiza o endereço no mapa e deixa ajustar o pino (útil em área rural). */
export function SeletorLocalizacao({ slug, coordenadas, enderecoAtual, aoMudar }: Props) {
  const geocodificacao = useMapsLibrary("geocoding");
  const mapa = useMap("seletor");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string>();

  async function localizar() {
    if (!geocodificacao) return;
    const endereco = enderecoAtual();
    if (endereco.length < 8) {
      setAviso("Preencha a rua, o número e a cidade antes de localizar.");
      return;
    }
    setBuscando(true);
    setAviso(undefined);
    try {
      const { results } = await new geocodificacao.Geocoder().geocode({ address: endereco, region: "br" });
      const local = results[0]?.geometry.location;
      if (!local) {
        setAviso("Não encontramos este endereço. Toque no mapa no local do comércio.");
        return;
      }
      const novo = { lat: local.lat(), lng: local.lng() };
      aoMudar(novo, "automatica");
      mapa?.panTo(novo);
      mapa?.setZoom(17);
    } catch (erro) {
      const codigo = String((erro as { code?: string })?.code ?? "");
      if (codigo === "REQUEST_DENIED") {
        void reportarFalhaMaps(slug, { ok: false, codigo: "Geocoding_REQUEST_DENIED" });
        setAviso("O Google recusou a localização. O ponto será salvo com localização pendente.");
      } else {
        setAviso("Não encontramos este endereço. Toque no mapa no local do comércio.");
      }
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" variante="secundario" onClick={localizar} disabled={!geocodificacao || buscando}>
          {buscando ? "Localizando…" : coordenadas ? "Localizar de novo" : "Localizar no mapa"}
        </Botao>
        <span className="text-sm text-texto-2">
          {coordenadas ? "Arraste o pino ou toque no mapa para ajustar." : "Opcional: sem localização, o ponto fica pendente."}
        </span>
      </div>
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
      <div className="h-72 overflow-hidden rounded-[var(--radius-cartao)] border border-borda">
        <Map
          id="seletor"
          mapId={ID_MAPA}
          defaultCenter={coordenadas ?? CENTRO_BRASIL}
          defaultZoom={coordenadas ? 17 : 4}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          onClick={(e) => {
            const ponto = e.detail.latLng;
            if (ponto) aoMudar(ponto, "ajustada");
          }}
        >
          {coordenadas && (
            <AdvancedMarker
              position={coordenadas}
              draggable
              onDragEnd={(e) => {
                const ponto = e.latLng;
                if (ponto) aoMudar({ lat: ponto.lat(), lng: ponto.lng() }, "ajustada");
              }}
            />
          )}
        </Map>
      </div>
    </div>
  );
}
