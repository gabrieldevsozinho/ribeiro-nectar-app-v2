import { env, exports } from "cloudflare:workers";
import { SENHA_DEV } from "../src/worker/seed/demo";

export const BASE = "https://ribeironectar.test";

type Opcoes = { metodo?: string; corpo?: unknown; cookie?: string; ip?: string };

/** Um IP diferente a cada login: o limite de tentativas por IP vale também nos testes. */
const ipQualquer = () => `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

/** Chama a API do Worker como o navegador chamaria. */
export async function chamar<T = any>(caminho: string, { metodo = "GET", corpo, cookie, ip }: Opcoes = {}) {
  const cabecalhos = new Headers({ origin: BASE });
  if (corpo !== undefined) cabecalhos.set("content-type", "application/json");
  if (cookie) cabecalhos.set("cookie", cookie);
  if (ip) cabecalhos.set("cf-connecting-ip", ip);
  // O tipo do `exports` não conhece o Worker principal; em tempo de execução ele é o app Hono.
  const resposta = await (exports as unknown as { default: Fetcher }).default.fetch(
    new Request(`${BASE}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }),
  );
  const dados = (await resposta.json().catch(() => null)) as T;
  return { status: resposta.status, dados, resposta };
}

/** Cookies da resposta no formato do cabeçalho "Cookie" (só nome=valor). */
export function cookiesDe(resposta: Response): string {
  return resposta.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Entra como um usuário de empresa e devolve o cookie da sessão. */
export async function entrar(email: string, slug = "apiario-ribeiro", senha = SENHA_DEV): Promise<string> {
  const { status, dados, resposta } = await chamar("/api/sessao/entrar", { metodo: "POST", corpo: { slug, email, senha }, ip: ipQualquer() });
  if (status !== 200) throw new Error(`Falha ao entrar como ${email}: ${JSON.stringify(dados)}`);
  return cookiesDe(resposta);
}

export async function entrarAdmin(email = "admin@ribeironectar.dev"): Promise<string> {
  const { status, dados, resposta } = await chamar("/api/sessao/entrar-admin", { metodo: "POST", corpo: { email, senha: SENHA_DEV }, ip: ipQualquer() });
  if (status !== 200) throw new Error(`Falha ao entrar como admin: ${JSON.stringify(dados)}`);
  return cookiesDe(resposta);
}

/** Consulta direta ao banco (sem passar pela API). */
export async function consultar<T = Record<string, unknown>>(sql: string, ...valores: unknown[]): Promise<T[]> {
  const { results } = await env.DB.prepare(sql).bind(...valores).all<T>();
  return results;
}

export async function perfilId(email: string): Promise<string> {
  const [linha] = await consultar<{ id: string }>("select id from perfis where email = ?", email);
  return linha.id;
}

export async function empresaId(slug: string): Promise<string> {
  const [linha] = await consultar<{ id: string }>("select id from empresas where slug = ?", slug);
  return linha.id;
}
