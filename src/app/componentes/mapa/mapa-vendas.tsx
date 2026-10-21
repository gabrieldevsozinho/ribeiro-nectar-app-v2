import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdvancedMarker, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { MarkerClusterer, SuperClusterAlgorithm, type Marker } from "@googlemaps/markerclusterer";
import { piorSituacao, type Situacao } from "@/compartilhado/semaforo";
import { CENTRO_BRASIL, ID_MAPA } from "./seletor-localizacao";
import { COR_PINO } from "./situacao";

export type Coordenada = { lat: number; lng: number };
export type MarcadorPonto = Coordenada & { id: string; nome: string; situacao: Situacao | null; selecionado: boolean };

/** O mesmo para o Google Maps e o OpenStreetMap. */
export type PropsMapaVendas = {
  pontos: MarcadorPonto[];
  minhaPosicao: Coordenada | null;
  /** Muda quando o mapa deve enquadrar de novo os pinos (outra cidade, outro filtro, "Estou aqui"). */
  enquadramento: string;
  /** Comércio escolhido na lista: o mapa vai até ele. */
  foco: string | null;
  aoEscolher: (id: string) => void;
};

/** Mapa com um pino por comércio, na cor da situação; pinos próximos se agrupam. */
export function MapaVendas(props: PropsMapaVendas) {
  return (
    <Map
      id="mapa-vendas"
      mapId={ID_MAPA}
      defaultCenter={CENTRO_BRASIL}
      defaultZoom={4}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      className="h-full w-full"
    >
      <Marcadores {...props} />
    </Map>
  );
}

function Marcadores({ pontos, minhaPosicao, enquadramento, foco, aoEscolher }: PropsMapaVendas) {
  const mapa = useMap("mapa-vendas");
  const [marcadores, setMarcadores] = useState<Record<string, Marker>>({});
  const situacoes = useRef(new WeakMap<Marker, Situacao | null>());
  const atuais = useRef({ pontos, minhaPosicao });
  useEffect(() => {
    atuais.current = { pontos, minhaPosicao };
  });

  // O grupo de pinos fica com a cor do pior comércio dele.
  const agrupador = useMemo(
    () =>
      mapa
        ? new MarkerClusterer({
            map: mapa,
            algorithm: new SuperClusterAlgorithm({ maxZoom: 14, radius: 60 }),
            renderer: {
              render: ({ count, markers, position }) => {
                const cor = COR_PINO[piorSituacao(markers.map((m) => situacoes.current.get(m) ?? null)) ?? "sem_prazo"];
                const tamanho = count < 10 ? 36 : count < 100 ? 42 : 48;
                const bolha = document.createElement("div");
                bolha.className = "grupo-pinos";
                Object.assign(bolha.style, { width: `${tamanho}px`, height: `${tamanho}px`, background: cor.fundo, color: cor.miolo });
                bolha.textContent = String(count);
                return new google.maps.marker.AdvancedMarkerElement({ position, content: bolha, zIndex: 1000 + count });
              },
            },
          })
        : null,
    [mapa],
  );

  // Enquadra os pinos (e a posição de quem está usando) quando muda a cidade, o filtro ou o "Estou aqui".
  useEffect(() => {
    if (!mapa) return;
    const { pontos: lista, minhaPosicao: eu } = atuais.current;
    const todos = eu ? [...lista, eu] : lista;
    if (todos.length === 0) return;
    if (todos.length === 1) {
      mapa.setCenter(todos[0]!);
      mapa.setZoom(15);
      return;
    }
    const limites = new google.maps.LatLngBounds();
    todos.forEach((p) => limites.extend(p));
    mapa.fitBounds(limites, 50);
  }, [mapa, enquadramento]);

  // Comércio escolhido na lista: o mapa vai até ele.
  useEffect(() => {
    const ponto = atuais.current.pontos.find((p) => p.id === foco);
    if (!mapa || !ponto) return;
    mapa.panTo(ponto);
    mapa.setZoom(Math.max(mapa.getZoom() ?? 0, 16));
  }, [mapa, foco]);

  useEffect(() => {
    if (!agrupador) return;
    agrupador.clearMarkers();
    agrupador.addMarkers(Object.values(marcadores));
  }, [agrupador, marcadores, pontos]);

  const registrar = useCallback((marcador: Marker | null, id: string, situacao: Situacao | null) => {
    if (marcador) situacoes.current.set(marcador, situacao);
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
        <PinoGoogle key={p.id} ponto={p} registrar={registrar} aoEscolher={aoEscolher} />
      ))}
      {minhaPosicao && (
        <AdvancedMarker position={minhaPosicao} title="Você está aqui" zIndex={2000}>
          <span className="block size-[18px] rounded-full border-[3px] border-white bg-[#1a73e8] shadow-md" />
        </AdvancedMarker>
      )}
    </>
  );
}

function PinoGoogle({
  ponto,
  registrar,
  aoEscolher,
}: {
  ponto: MarcadorPonto;
  registrar: (marcador: Marker | null, id: string, situacao: Situacao | null) => void;
  aoEscolher: (id: string) => void;
}) {
  // Referência estável: só é chamada de novo quando o pino ou a cor mudam (senão o agrupador se registraria em laço).
  const { id, situacao } = ponto;
  const aoMontar = useCallback((marcador: Marker | null) => registrar(marcador, id, situacao), [registrar, id, situacao]);
  const cor = COR_PINO[situacao ?? "sem_prazo"];
  return (
    <AdvancedMarker
      position={ponto}
      title={ponto.nome}
      zIndex={ponto.selecionado ? 1000 : undefined}
      ref={aoMontar}
      onClick={() => aoEscolher(id)}
    >
      <Pin background={cor.fundo} borderColor={cor.borda} glyphColor={cor.miolo} scale={ponto.selecionado ? 1.25 : 1} />
    </AdvancedMarker>
  );
}
