/**
 * Endereço → coordenadas com o Nominatim (OpenStreetMap), usado quando MAPA_PROVEDOR=osm.
 * A política do serviço público pede no máximo 1 consulta por segundo e a identificação do app:
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * As consultas entram numa fila: dentro da mesma instância do Worker, o serviço recebe uma por vez.
 * (Instâncias diferentes não compartilham a fila; para uso intenso, use um provedor com plano próprio.)
 */
let ultimaConsulta = 0;
let fila: Promise<unknown> = Promise.resolve();

async function consultar(contato: string, endereco: string): Promise<{ lat: number; lng: number } | null> {
  const espera = Math.max(0, ultimaConsulta + 1100 - Date.now());
  if (espera) await new Promise((r) => setTimeout(r, espera));
  ultimaConsulta = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: endereco, format: "jsonv2", limit: "1", countrycodes: "br", "accept-language": "pt-BR" }).toString();
  const resposta = await fetch(url, {
    headers: { "User-Agent": `RibeiroNectar/1.0 (${contato || "contato@gabrielstudio.com.br"})` },
  });
  if (!resposta.ok) throw new Error(`Nominatim ${resposta.status}`);
  const [achado] = (await resposta.json()) as { lat: string; lon: string }[];
  return achado ? { lat: Number(achado.lat), lng: Number(achado.lon) } : null;
}

/** Devolve o ponto encontrado (ou null se o endereço não existir); ok: false se o serviço falhar. */
export async function geocodificarEndereco(
  env: Env,
  endereco: string,
): Promise<{ ok: true; ponto: { lat: number; lng: number } | null } | { ok: false }> {
  const limpo = endereco.trim();
  if (limpo.length < 8 || limpo.length > 300) return { ok: false };
  const minha = fila.then(() => consultar(env.NOMINATIM_CONTATO, limpo));
  fila = minha.catch(() => null);
  try {
    return { ok: true, ponto: await minha };
  } catch {
    return { ok: false };
  }
}
