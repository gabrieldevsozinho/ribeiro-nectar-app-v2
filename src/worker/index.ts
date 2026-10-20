/**
 * Worker do Ribeiro Néctar: a API (Hono) em /api/*.
 * O resto dos endereços é o app React, servido pelos arquivos estáticos (wrangler.jsonc → assets).
 */
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { z } from "zod";
import { criarAuth, type Auth } from "./auth/auth";
import { criarDb, type Db } from "./db/cliente";
import { ErroDeNegocio } from "./erros";
import { rotasAdmin } from "./rotas/admin";
import { rotasAcessoInicial, rotasEmpresa } from "./rotas/empresa";
import { rotasPublicas } from "./rotas/publico";
import { rotasSessao } from "./rotas/sessao";
import { CodigoRecusado } from "./servicos/revendedores";
import { HTML_TESTE_GOOGLE_MAPS } from "./teste-google-maps";
import type { AppEnv } from "./tipos";

// Mensagens de validação do Zod em português.
z.config(z.locales.ptBR());

/** Banco e login criados uma vez por instância do Worker (o env é o mesmo entre requisições). */
const porAmbiente = new WeakMap<Env, { db: Db; auth: Auth }>();
function servicos(env: Env) {
  let atual = porAmbiente.get(env);
  if (!atual) {
    const db = criarDb(env.DB);
    atual = { db, auth: criarAuth(env, db) };
    porAmbiente.set(env, atual);
  }
  return atual;
}

const CABECALHOS_SEGURANCA: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Frame-Options": "DENY",
  // Respostas da API têm dados do usuário: nada de cache.
  "Cache-Control": "no-store",
};

const app = new Hono<AppEnv>().basePath("/api");

app.use("*", async (c, next) => {
  await next();
  for (const [nome, valor] of Object.entries(CABECALHOS_SEGURANCA)) {
    if (!c.res.headers.has(nome)) c.res.headers.set(nome, valor);
  }
});

// Formulários enviados de outro site são recusados (as chamadas JSON já são protegidas pelo navegador).
app.use("*", csrf({ origin: (origem, c) => origem === new URL(c.env.BETTER_AUTH_URL).origin }));

app.use("*", async (c, next) => {
  const { db, auth } = servicos(c.env);
  c.set("db", db);
  c.set("auth", auth);
  await next();
});

app.route("/sessao", rotasSessao);
app.route("/publico", rotasPublicas);
app.route("/admin", rotasAdmin);
app.route("/e/:slug", rotasAcessoInicial);
app.route("/e/:slug", rotasEmpresa);

app.get("/teste-google-maps", (c) => {
  // Só pode ser aberta dentro do próprio sistema.
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Content-Security-Policy", "frame-ancestors 'self'");
  return c.html(HTML_TESTE_GOOGLE_MAPS);
});

app.notFound((c) => c.json({ erro: "Endereço não encontrado." }, 404));

app.onError((erro, c) => {
  if (erro instanceof CodigoRecusado) return c.json({ erro: erro.message, codigoEnviado: erro.podeTentarDeNovo }, 422);
  if (erro instanceof ErroDeNegocio) return c.json({ erro: erro.message }, 422);
  console.error(erro);
  return c.json({ erro: "Não foi possível concluir. Tente de novo." }, 500);
});

export default app;
