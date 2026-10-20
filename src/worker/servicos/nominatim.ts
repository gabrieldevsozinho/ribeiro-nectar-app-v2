/**
 * Endereço → coordenadas com o Nominatim (OpenStreetMap), usado quando MAPA_PROVEDOR=osm.
 * A política do serviço público pede no máximo 1 consulta por segundo e a identificação do app:
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * Por que a busca é em etapas: mandar o endereço inteiro de uma vez (com bairro, CEP e "Brasil") faz o
 * Nominatim errar, e o OpenStreetMap, em cidades pequenas, costuma ter a rua mas não o número da casa.
 * Então tentamos do mais preciso ao menos preciso (rua + número, depois só a rua, depois a cidade) e
 * devolvemos junto o quanto o resultado é preciso, para a tela avisar o usuário.
 *
 * As consultas entram numa fila: dentro da mesma instância do Worker, o serviço recebe uma por vez.
 * (Instâncias diferentes não compartilham a fila; para uso intenso, use um provedor com plano próprio.)
 */
import { NOMES_UF } from "@/compartilhado/uf";
import type { EnderecoBusca, RespostaGeocodificacao } from "@/compartilhado/tipos";

/** Abreviações comuns no começo do endereço que o Nominatim não entende. */
const ABREVIACOES: [RegExp, string][] = [
  [/^av\.?\s+/i, "Avenida "],
  [/^r\.?\s+/i, "Rua "],
  [/^rod\.?\s+/i, "Rodovia "],
  [/^estr\.?\s+/i, "Estrada "],
  [/^al\.?\s+/i, "Alameda "],
  [/^tv\.?\s+/i, "Travessa "],
  [/^p[cç]a\.?\s+/i, "Praça "],
  [/^lgo\.?\s+/i, "Largo "],
];

export function expandirLogradouro(logradouro: string): string {
  let texto = logradouro.trim().replace(/\s+/g, " ");
  for (const [padrao, completo] of ABREVIACOES) {
    if (padrao.test(texto)) {
      texto = texto.replace(padrao, completo);
      break;
    }
  }
  return texto;
}

type Tentativa = { parametros: Record<string, string>; precisao: "exata" | "rua" | "cidade" };

/** As buscas, da mais precisa para a menos precisa. */
export function montarTentativas(e: EnderecoBusca): Tentativa[] {
  const rua = expandirLogradouro(e.logradouro);
  const numero = e.numero.trim();
  const cidade = { city: e.cidade.trim(), state: NOMES_UF[e.uf.toUpperCase()] ?? e.uf };
  const tentativas: Tentativa[] = [];

  if (rua && numero) tentativas.push({ parametros: { street: `${numero} ${rua}`, ...cidade }, precisao: "exata" });
  if (rua) tentativas.push({ parametros: { street: rua, ...cidade }, precisao: "rua" });
  tentativas.push({ parametros: cidade, precisao: "cidade" });
  return tentativas;
}

let ultimaConsulta = 0;
let fila: Promise<unknown> = Promise.resolve();

type Achado = { lat: string; lon: string; addresstype?: string; address?: { house_number?: string } };

async function consultar(contato: string, parametros: Record<string, string>): Promise<Achado | null> {
  const espera = Math.max(0, ultimaConsulta + 1100 - Date.now());
  if (espera) await new Promise((r) => setTimeout(r, espera));
  ultimaConsulta = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    ...parametros,
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    countrycodes: "br",
    "accept-language": "pt-BR",
  }).toString();
  const resposta = await fetch(url, {
    headers: { "User-Agent": `RibeiroNectar/1.0 (${contato || "contato@gabrielstudio.com.br"})` },
  });
  if (!resposta.ok) throw new Error(`Nominatim ${resposta.status}`);
  const [achado] = (await resposta.json()) as Achado[];
  return achado ?? null;
}

async function buscar(contato: string, endereco: EnderecoBusca): Promise<RespostaGeocodificacao> {
  for (const { parametros, precisao } of montarTentativas(endereco)) {
    const achado = await consultar(contato, parametros);
    if (!achado) continue;
    // Pedimos rua + número, mas o OpenStreetMap pode ter devolvido só a rua: confere o que veio.
    const temNumero = Boolean(achado.address?.house_number);
    const nivel = precisao === "exata" && !temNumero ? "rua" : precisao;
    return { ok: true, ponto: { lat: Number(achado.lat), lng: Number(achado.lon), precisao: nivel } };
  }
  return { ok: true, ponto: null };
}

/** Devolve o ponto encontrado e o quanto ele é preciso; ponto nulo se nada for encontrado; ok: false se o serviço falhar. */
export async function geocodificarEndereco(env: Env, endereco: EnderecoBusca): Promise<RespostaGeocodificacao> {
  if (!endereco.cidade.trim() || !endereco.uf.trim()) return { ok: false };
  const minha = fila.then(() => buscar(env.NOMINATIM_CONTATO, endereco));
  fila = minha.catch(() => null);
  try {
    return await minha;
  } catch {
    return { ok: false };
  }
}
