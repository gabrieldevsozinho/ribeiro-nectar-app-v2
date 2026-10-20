/**
 * Entrar e sair. O login passa pelo Better Auth (senha, limite de tentativas, cookie
 * de sessão) e, em seguida, pelas regras do sistema: empresa do endereço, bloqueio,
 * empresa desativada. Se alguma falhar, a sessão recém-criada é desfeita.
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { esquemaCredenciais, esquemaEntrarEmpresa } from "@/compartilhado/esquemas";
import { COOKIE_ULTIMA_EMPRESA } from "@/compartilhado/slug";
import { encerrarSessao, obterSessao, paraNavegador } from "../acesso";
import { empresas, perfis } from "../db/esquema";
import { validar } from "../erros";
import type { AppEnv, Ctx } from "../tipos";

const ERRO_LOGIN = "E-mail ou senha incorretos.";
const MUITAS_TENTATIVAS = "Muitas tentativas de login. Aguarde um minuto e tente de novo.";

type Autenticacao = { ok: true; token: string; userId: string; cookies: string[] } | { ok: false; erro: string };

/** Confere e-mail e senha pelo Better Auth (o mesmo caminho do login dele, com limite de tentativas por IP). */
async function autenticar(c: Ctx, email: string, senha: string): Promise<Autenticacao> {
  const cabecalhos = new Headers({ "Content-Type": "application/json" });
  for (const nome of ["cf-connecting-ip", "x-forwarded-for", "user-agent", "cookie"]) {
    const valor = c.req.header(nome);
    if (valor) cabecalhos.set(nome, valor);
  }
  cabecalhos.set("origin", c.req.header("origin") ?? new URL(c.env.BETTER_AUTH_URL).origin);

  const resposta = await c.get("auth").handler(
    new Request(new URL("/api/auth/sign-in/email", c.env.BETTER_AUTH_URL), {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ email, password: senha, rememberMe: true }),
    }),
  );
  if (resposta.status === 429) return { ok: false, erro: MUITAS_TENTATIVAS };
  if (!resposta.ok) return { ok: false, erro: ERRO_LOGIN };

  const corpo = (await resposta.json()) as { token: string; user: { id: string } };
  return { ok: true, token: corpo.token, userId: corpo.user.id, cookies: resposta.headers.getSetCookie() };
}

async function desfazerSessao(c: Ctx, token: string) {
  const contexto = await c.get("auth").$context;
  await contexto.internalAdapter.deleteSession(token);
}

function gravarCookies(c: Ctx, cookies: string[]) {
  for (const cookie of cookies) c.header("Set-Cookie", cookie, { append: true });
}

async function perfilDoLogin(c: Ctx, userId: string) {
  return c
    .get("db")
    .select({
      papel: perfis.papel,
      bloqueado: perfis.bloqueado,
      excluidoEm: perfis.excluidoEm,
      deveTrocarSenha: perfis.deveTrocarSenha,
      slug: empresas.slug,
      ativa: empresas.ativa,
    })
    .from(perfis)
    .leftJoin(empresas, eq(empresas.id, perfis.empresaId))
    .where(eq(perfis.userId, userId))
    .get();
}

export const rotasSessao = new Hono<AppEnv>()
  /** Estado da sessão (as telas de login usam para pular direto para dentro). */
  .get("/", async (c) => {
    const sessao = await obterSessao(c);
    return c.json(sessao.estado === "ok" ? { estado: "ok" as const, usuario: paraNavegador(sessao.usuario) } : { estado: sessao.estado });
  })

  /** Login de um usuário de empresa, no endereço /[empresa]/login. */
  .post("/entrar", validar("json", esquemaEntrarEmpresa), async (c) => {
    const { slug, email, senha } = c.req.valid("json");
    if (!email || !senha) return c.json({ erro: "Informe e-mail e senha." }, 422);

    const login = await autenticar(c, email, senha);
    if (!login.ok) return c.json({ erro: login.erro }, 422);

    const perfil = await perfilDoLogin(c, login.userId);
    let erro: string | null = null;
    if (!perfil || perfil.excluidoEm) erro = ERRO_LOGIN;
    else if (perfil.papel === "admin_plataforma") erro = "Este é um acesso da plataforma. Entre por /admin/login.";
    else if (perfil.bloqueado) erro = "Seu acesso está bloqueado. Fale com o responsável da sua empresa.";
    else if (perfil.slug !== slug) erro = "Este usuário não pertence a esta empresa.";
    else if (!perfil.ativa) erro = "O acesso desta empresa está suspenso. Fale com a Gabriel Studio.";

    if (erro || !perfil) {
      await desfazerSessao(c, login.token);
      return c.json({ erro: erro ?? ERRO_LOGIN }, 422);
    }

    gravarCookies(c, login.cookies);
    // Lembra a empresa neste aparelho: o app instalado abre direto nela.
    setCookie(c, COOKIE_ULTIMA_EMPRESA, slug, {
      httpOnly: true,
      sameSite: "Lax",
      secure: c.env.AMBIENTE !== "desenvolvimento",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return c.json({ destino: perfil.deveTrocarSenha ? `/${slug}/primeiro-acesso` : `/${slug}/vendas` });
  })

  /** Login do administrador da plataforma, em /admin/login. */
  .post("/entrar-admin", validar("json", esquemaCredenciais), async (c) => {
    const { email, senha } = c.req.valid("json");
    if (!email || !senha) return c.json({ erro: "Informe e-mail e senha." }, 422);

    const login = await autenticar(c, email, senha);
    if (!login.ok) return c.json({ erro: login.erro }, 422);

    const perfil = await perfilDoLogin(c, login.userId);
    if (!perfil || perfil.papel !== "admin_plataforma" || perfil.bloqueado || perfil.excluidoEm) {
      await desfazerSessao(c, login.token);
      return c.json({ erro: "Este usuário não tem acesso ao painel da plataforma." }, 422);
    }

    gravarCookies(c, login.cookies);
    return c.json({ destino: "/admin/empresas" });
  })

  /** Encerra a sessão. */
  .post("/sair", async (c) => {
    await encerrarSessao(c);
    return c.json({ ok: true });
  });
