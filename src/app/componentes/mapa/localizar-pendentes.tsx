import { useEffect, useRef, useState } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Aviso, Botao } from "../ui";
import { definirLocalizacao, geocodificarEndereco, pontosPendentes } from "../../chamadas";
import type { ConfigMapaCliente } from "./provedor-mapa";

type Pendente = { id: string; logradouro: string; numero: string | null; bairro: string | null; cidade: string; uf: string; cep: string | null };
type Geocodificar = (pendente: Pendente) => Promise<{ lat: number; lng: number } | null>;

function montarEndereco(p: Pendente) {
  return [[p.logradouro, p.numero].filter(Boolean).join(", "), p.bairro, `${p.cidade} - ${p.uf}`, p.cep, "Brasil"]
    .filter(Boolean)
    .join(", ");
}

/** Localiza os pontos cadastrados enquanto não havia mapa (Google com chave, ou OpenStreetMap). */
export function LocalizarPendentes({ config, automatico = false }: { config: ConfigMapaCliente; automatico?: boolean }) {
  if (config.provedor === "osm") return <LocalizadorOsm slug={config.slug} automatico={automatico} />;
  if (!config.chave) return null;
  return (
    <APIProvider apiKey={config.chave} language="pt-BR" region="BR">
      <LocalizadorGoogle slug={config.slug} automatico={automatico} />
    </APIProvider>
  );
}

function LocalizadorGoogle({ slug, automatico }: { slug: string; automatico: boolean }) {
  const geocodificacao = useMapsLibrary("geocoding");
  const geocodificar: Geocodificar | null = geocodificacao
    ? async (pendente) => {
        const { results } = await new geocodificacao.Geocoder().geocode({ address: montarEndereco(pendente), region: "br" });
        const local = results[0]?.geometry.location;
        return local ? { lat: local.lat(), lng: local.lng() } : null;
      }
    : null;
  return <Localizador slug={slug} automatico={automatico} geocodificar={geocodificar} />;
}

function LocalizadorOsm({ slug, automatico }: { slug: string; automatico: boolean }) {
  const geocodificar: Geocodificar = async (p) => {
    const resultado = await geocodificarEndereco(slug, {
      logradouro: p.logradouro,
      numero: p.numero ?? "",
      bairro: p.bairro ?? "",
      cidade: p.cidade,
      uf: p.uf,
      cep: p.cep ?? "",
    });
    if (!resultado.ok) throw new Error("servico_indisponivel");
    // Só o centro da cidade não localiza o comércio: fica pendente para o master ajustar pelo pino.
    return resultado.ponto && resultado.ponto.precisao !== "cidade" ? resultado.ponto : null;
  };
  return <Localizador slug={slug} automatico={automatico} geocodificar={geocodificar} />;
}

function Localizador({ slug, automatico, geocodificar }: { slug: string; automatico: boolean; geocodificar: Geocodificar | null }) {
  const [andamento, setAndamento] = useState<{ feitos: number; total: number; falhas: number } | null>(null);
  const [rodando, setRodando] = useState(false);
  const iniciado = useRef(false);
  const geocodificarRef = useRef(geocodificar);
  useEffect(() => {
    geocodificarRef.current = geocodificar;
  });

  async function localizarTodos() {
    const buscar = geocodificarRef.current;
    if (!buscar || iniciado.current) return;
    iniciado.current = true;
    await Promise.resolve();
    setRodando(true);
    const pendentes = (await pontosPendentes(slug)) as Pendente[];
    let falhas = 0;
    setAndamento({ feitos: 0, total: pendentes.length, falhas });

    for (const [indice, p] of pendentes.entries()) {
      try {
        const local = await buscar(p);
        if (local) await definirLocalizacao(slug, p.id, local.lat, local.lng, "automatica");
        else falhas++;
      } catch {
        falhas++;
      }
      setAndamento({ feitos: indice + 1, total: pendentes.length, falhas });
    }
    setRodando(false);
    iniciado.current = false;
  }

  // No mapa, o master não precisa clicar: os pendentes são localizados ao abrir.
  const pronto = geocodificar !== null;
  useEffect(() => {
    if (automatico && pronto) void localizarTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatico, pronto]);

  return (
    <Aviso tipo="alerta" titulo="Há pontos com localização pendente">
      <p>Foram cadastrados enquanto o mapa estava desligado. Agora dá para localizá-los no mapa.</p>
      {andamento && (
        <p className="mt-1">
          {andamento.feitos} de {andamento.total} processados
          {andamento.falhas > 0 && ` · ${andamento.falhas} não encontrados (ajuste pelo pino na página do ponto)`}.
        </p>
      )}
      <Botao type="button" variante="secundario" className="mt-2 min-h-9 text-sm" disabled={!pronto || rodando} onClick={localizarTodos}>
        {rodando ? "Localizando…" : "Localizar agora"}
      </Botao>
    </Aviso>
  );
}
