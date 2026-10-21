/** Chamadas usadas por mais de uma tela (mapa, pontos, vendas). */
import type { ResultadoTesteMaps } from "@/compartilhado/google-maps-erros";
import type { EnderecoBusca, PaginaVendas, PontoPendente, RespostaGeocodificacao } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila } from "./api";

/** Avisa o sistema que o Google recusou a chave durante o uso (os masters veem a faixa no topo). */
export function reportarFalhaMaps(slug: string, resultado: ResultadoTesteMaps) {
  return api.post(daEmpresa(slug, "/google-maps/falha"), { resultado }).catch(() => undefined);
}

/** Endereço → coordenadas pelo Nominatim (modo OpenStreetMap), passando pelo Worker. */
export function geocodificarEndereco(slug: string, endereco: EnderecoBusca): Promise<RespostaGeocodificacao> {
  return api.post<RespostaGeocodificacao>(daEmpresa(slug, "/geocodificar"), endereco).catch(() => ({ ok: false }) as const);
}

/** Pontos sem localização. Sem `incluirNaoEncontrados`, só os que a busca automática ainda não tentou. */
export function pontosPendentes(slug: string, incluirNaoEncontrados = false) {
  return api.get<PontoPendente[]>(daEmpresa(slug, `/pontos/pendentes${incluirNaoEncontrados ? "?todos=1" : ""}`));
}

/** A busca não achou o endereço: o ponto não é procurado de novo sozinho. */
export function marcarNaoEncontrado(slug: string, pontoId: string) {
  return api.post(daEmpresa(slug, `/pontos/${pontoId}/localizacao/nao-encontrada`)).catch(() => undefined);
}

/** Grava a localização encontrada no mapa (pendentes localizados ou pino ajustado). */
export async function definirLocalizacao(slug: string, pontoId: string, latitude: number, longitude: number, status: "automatica" | "ajustada") {
  try {
    await api.patch(daEmpresa(slug, `/pontos/${pontoId}/localizacao`), { latitude, longitude, status });
    // A localização aparece em várias telas (ponto, mapa, lista de pontos): recarrega as da empresa.
    void fila.invalidateQueries({ queryKey: chave(slug) });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function carregarVendasDoPonto(slug: string, pontoId: string, pagina: number) {
  return api.get<PaginaVendas>(daEmpresa(slug, `/pontos/${pontoId}/vendas?pagina=${pagina}`));
}
