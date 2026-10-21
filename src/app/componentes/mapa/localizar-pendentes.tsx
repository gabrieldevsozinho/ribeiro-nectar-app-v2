import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { contar } from "@/compartilhado/formato";
import type { PontoPendente } from "@/compartilhado/tipos";
import { chave, fila } from "../../api";
import { Aviso, Botao } from "../ui";
import { IconeAlerta } from "../icones";
import { definirLocalizacao, geocodificarEndereco, marcarNaoEncontrado, pontosPendentes } from "../../chamadas";
import type { ConfigMapaCliente } from "./provedor-mapa";

/** Endereço achado, null se não achou. Lança erro se o serviço de mapas falhou (aí tenta de novo depois). */
type Geocodificar = (pendente: PontoPendente) => Promise<{ lat: number; lng: number } | null>;

/**
 * "botao": aviso com o botão "Localizar agora" (lista de pontos).
 * "mapa": localiza sozinho os que ainda não foram procurados e mostra, num aviso pequeno, os não encontrados.
 */
type Modo = { modo: "botao" } | { modo: "mapa"; aLocalizar: number; naoEncontrados: PontoPendente[] };
type Props = { config: ConfigMapaCliente } & Modo;

function montarEndereco(p: PontoPendente) {
  return [[p.logradouro, p.numero].filter(Boolean).join(", "), p.bairro, `${p.cidade} - ${p.uf}`, p.cep, "Brasil"]
    .filter(Boolean)
    .join(", ");
}

/** Localiza os pontos cadastrados enquanto não havia mapa (Google com chave, ou OpenStreetMap). */
export function LocalizarPendentes(props: Props) {
  if (props.config.provedor === "osm") return <LocalizadorOsm {...props} />;
  if (!props.config.chave) return null;
  return (
    <APIProvider apiKey={props.config.chave} language="pt-BR" region="BR">
      <LocalizadorGoogle {...props} />
    </APIProvider>
  );
}

function LocalizadorGoogle(props: Props) {
  const geocodificacao = useMapsLibrary("geocoding");
  const geocodificar: Geocodificar | null = geocodificacao
    ? async (pendente) => {
        try {
          const { results } = await new geocodificacao.Geocoder().geocode({ address: montarEndereco(pendente), region: "br" });
          const local = results[0]?.geometry.location;
          return local ? { lat: local.lat(), lng: local.lng() } : null;
        } catch (erro) {
          // Endereço inexistente vem como erro ZERO_RESULTS; os outros erros são do serviço.
          if ((erro as { code?: string }).code === "ZERO_RESULTS") return null;
          throw erro;
        }
      }
    : null;
  return <Localizador {...props} geocodificar={geocodificar} />;
}

function LocalizadorOsm(props: Props) {
  const slug = props.config.slug;
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
  return <Localizador {...props} geocodificar={geocodificar} />;
}

function Localizador(props: Props & { geocodificar: Geocodificar | null }) {
  const slug = props.config.slug;
  const [andamento, setAndamento] = useState<{ feitos: number; total: number; falhas: number } | null>(null);
  const [rodando, setRodando] = useState(false);
  const iniciado = useRef(false);
  const geocodificarRef = useRef(props.geocodificar);
  useEffect(() => {
    geocodificarRef.current = props.geocodificar;
  });

  async function localizar(incluirNaoEncontrados: boolean) {
    const buscar = geocodificarRef.current;
    if (!buscar || iniciado.current) return;
    iniciado.current = true;
    setRodando(true);
    try {
      const pendentes = await pontosPendentes(slug, incluirNaoEncontrados);
      let falhas = 0;
      setAndamento({ feitos: 0, total: pendentes.length, falhas });
      for (const [indice, p] of pendentes.entries()) {
        try {
          const local = await buscar(p);
          if (local) {
            await definirLocalizacao(slug, p.id, local.lat, local.lng, "automatica");
          } else {
            falhas++;
            await marcarNaoEncontrado(slug, p.id);
          }
        } catch {
          falhas++; // serviço fora do ar: não marca, tenta de novo da próxima vez
        }
        setAndamento({ feitos: indice + 1, total: pendentes.length, falhas });
      }
    } catch {
      // Sem conexão: fica para a próxima vez.
    } finally {
      setRodando(false);
      iniciado.current = false;
      // Os pinos novos e a lista de não encontrados aparecem nas telas da empresa.
      void fila.invalidateQueries({ queryKey: chave(slug) });
    }
  }

  // No mapa, o master não precisa clicar: os pendentes ainda não procurados são localizados ao abrir.
  const pronto = props.geocodificar !== null;
  const aLocalizar = props.modo === "mapa" ? props.aLocalizar : 0;
  useEffect(() => {
    if (aLocalizar > 0 && pronto) void localizar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aLocalizar, pronto]);

  if (props.modo === "botao") {
    return (
      <Aviso tipo="alerta" titulo="Há pontos com localização pendente">
        <p>Foram cadastrados enquanto o mapa estava desligado. Agora dá para localizá-los no mapa.</p>
        {andamento && (
          <p className="mt-1">
            {andamento.feitos} de {andamento.total} processados
            {andamento.falhas > 0 && ` · ${andamento.falhas} não encontrados (ajuste pelo pino na página do ponto)`}.
          </p>
        )}
        <Botao type="button" variante="secundario" className="mt-2 min-h-9 text-sm" disabled={!pronto || rodando} onClick={() => localizar(true)}>
          {rodando ? "Localizando…" : "Localizar agora"}
        </Botao>
      </Aviso>
    );
  }

  if (rodando) {
    return (
      <p className="flex items-center gap-2 text-sm text-texto-2" role="status">
        <span className="size-3.5 animate-spin rounded-full border-2 border-mel border-t-transparent" />
        Localizando comércios no mapa{andamento && andamento.total > 0 ? ` (${andamento.feitos} de ${andamento.total})` : ""}…
      </p>
    );
  }

  const { naoEncontrados } = props;
  if (naoEncontrados.length === 0) return null;
  return (
    <details className="group rounded-xl border border-alerta/30 bg-alerta-claro text-sm text-alerta">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 font-semibold [&::-webkit-details-marker]:hidden">
        <IconeAlerta tamanho={18} className="shrink-0" />
        <span className="min-w-0 flex-1">{contar(naoEncontrados.length, "comércio fora do mapa", "comércios fora do mapa")}</span>
        <span className="shrink-0 font-normal underline underline-offset-2 group-open:hidden">Ver</span>
        <span className="hidden shrink-0 font-normal underline underline-offset-2 group-open:inline">Fechar</span>
      </summary>
      <div className="border-t border-alerta/20 px-3.5 pb-3 pt-2">
        <p className="opacity-95">Não achamos estes endereços no mapa. Abra cada um e arraste o pino até o lugar certo.</p>
        <ul className="mt-2 divide-y divide-alerta/15">
          {naoEncontrados.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.nome}</span>
                <span className="block truncate opacity-90">
                  {[p.logradouro, p.numero].filter(Boolean).join(", ")} · {p.cidade}/{p.uf}
                </span>
              </span>
              <Link
                to={`/${slug}/pontos/${p.id}/editar`}
                className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-alerta/40 bg-superficie px-3 font-semibold text-texto hover:bg-superficie-2"
              >
                Ajustar pino
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => localizar(true)}
          disabled={!pronto}
          className="mt-1 min-h-9 font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          Tentar localizar de novo
        </button>
      </div>
    </details>
  );
}
