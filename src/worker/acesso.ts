/**
 * Camada de acesso: descobre quem está logado e confere se pode estar onde está.
 *
 * No projeto original, o Postgres (RLS) filtrava os dados de cada empresa. O D1 não
 * tem RLS: aqui, toda rota de empresa passa por exigirUsuarioDaEmpresa, e os serviços
 * só consultam com o empresaId e o perfilId que vêm da sessão (nunca do navegador).
 * Os gatilhos do banco são a segunda proteção.
 */
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { MotivoAcesso, UsuarioLogado } from "@/compartilhado/tipos";
import { empresas, perfis } from "./db/esquema";
import type { AppEnv, Ctx, UsuarioDaEmpresa } from "./tipos";

export type Usuario = UsuarioLogado & { userId: string };

export type Sessao =
  | { estado: "anonimo" }
  | { estado: "bloqueado" | "excluido" | "sem_perfil" | "empresa_inativa" }
  | { estado: "ok"; usuario: Usuario };

/** Repassa à resposta os cookies que o Better Auth pediu para gravar (sessão renovada, saída…). */
export function repassarCookies(c: Ctx, cabecalhos: Headers) {
  for (const cookie of cabecalhos.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
}

/** Lê a sessão uma vez por requisição. */
export async function obterSessao(c: Ctx): Promise<Sessao> {
  const lida = c.get("sessao");
  if (lida) return lida;

  const { headers, response } = await c.get("auth").api.getSession({ headers: c.req.raw.headers, returnHeaders: true });
  repassarCookies(c, headers);

  let sessao: Sessao;
  if (!response) {
    sessao = { estado: "anonimo" };
  } else {
    const perfil = await c
      .get("db")
      .select({
        id: perfis.id,
        nome: perfis.nome,
        email: perfis.email,
        papel: perfis.papel,
        deveTrocarSenha: perfis.deveTrocarSenha,
        compartilhaVendas: perfis.compartilhaVendas,
        bloqueado: perfis.bloqueado,
        excluidoEm: perfis.excluidoEm,
        empresaId: empresas.id,
        empresaNome: empresas.nome,
        empresaSlug: empresas.slug,
        empresaAtiva: empresas.ativa,
      })
      .from(perfis)
      .leftJoin(empresas, eq(empresas.id, perfis.empresaId))
      .where(eq(perfis.userId, response.user.id))
      .get();

    if (!perfil) sessao = { estado: "sem_perfil" };
    else if (perfil.excluidoEm) sessao = { estado: "excluido" };
    else if (perfil.bloqueado) sessao = { estado: "bloqueado" };
    else if (perfil.papel !== "admin_plataforma" && !perfil.empresaAtiva) sessao = { estado: "empresa_inativa" };
    else
      sessao = {
        estado: "ok",
        usuario: {
          userId: response.user.id,
          perfilId: perfil.id,
          nome: perfil.nome,
          email: perfil.email,
          papel: perfil.papel,
          deveTrocarSenha: perfil.deveTrocarSenha,
          compartilhaVendas: perfil.compartilhaVendas,
          empresa:
            perfil.empresaId && perfil.empresaNome && perfil.empresaSlug
              ? { id: perfil.empresaId, nome: perfil.empresaNome, slug: perfil.empresaSlug }
              : null,
        },
      };
  }

  c.set("sessao", sessao);
  return sessao;
}

/** Encerra a sessão atual (se houver) e apaga o cookie no navegador. */
export async function encerrarSessao(c: Ctx) {
  try {
    const { headers } = await c.get("auth").api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    repassarCookies(c, headers);
  } catch {
    // Sem sessão válida: não há o que encerrar.
  }
}

export function negar(c: Ctx, status: ContentfulStatusCode, motivo: MotivoAcesso, erro: string) {
  return c.json({ erro, motivo }, status);
}

const MOTIVO_DO_ESTADO = {
  bloqueado: "bloqueado",
  excluido: "excluido",
  sem_perfil: "outra-empresa",
  empresa_inativa: "empresa-inativa",
} as const satisfies Record<string, MotivoAcesso>;

const SESSAO_EXPIRADA = "Sua sessão expirou ou você não tem permissão. Entre de novo.";

/**
 * Exige um usuário logado que pertença à empresa do endereço (/api/e/:slug/...).
 * Usuário bloqueado, excluído, de empresa desativada ou de outra empresa tem a sessão encerrada.
 */
export function exigirUsuarioDaEmpresa(opcoes: { permitirTrocaPendente?: boolean } = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const slug = c.req.param("slug");
    const sessao = await obterSessao(c);

    if (sessao.estado === "anonimo") return negar(c, 401, "anonimo", SESSAO_EXPIRADA);
    if (sessao.estado !== "ok") {
      await encerrarSessao(c);
      return negar(c, 403, MOTIVO_DO_ESTADO[sessao.estado], SESSAO_EXPIRADA);
    }

    const { usuario } = sessao;
    if (usuario.papel === "admin_plataforma") return negar(c, 403, "admin", "Este é um acesso da plataforma.");
    if (usuario.empresa?.slug !== slug) {
      await encerrarSessao(c);
      return negar(c, 403, "outra-empresa", "Este usuário não pertence a esta empresa.");
    }
    if (usuario.deveTrocarSenha && !opcoes.permitirTrocaPendente) {
      return negar(c, 403, "trocar-senha", "Troque a senha temporária antes de continuar.");
    }

    c.set("usuario", usuario);
    await next();
  });
}

/** Depois de exigirUsuarioDaEmpresa: só o master passa. */
export const exigirMaster = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("usuario").papel !== "master") return negar(c, 403, "so-master", "Só o master pode fazer isso.");
  await next();
});

/** Exige o administrador da plataforma. */
export const exigirAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const sessao = await obterSessao(c);
  if (sessao.estado === "anonimo") return negar(c, 401, "anonimo", SESSAO_EXPIRADA);
  if (sessao.estado !== "ok" || sessao.usuario.papel !== "admin_plataforma") {
    await encerrarSessao(c);
    return negar(c, 403, "sem-permissao", "Este usuário não tem acesso ao painel da plataforma.");
  }
  c.set("usuario", sessao.usuario);
  await next();
});

/** O usuário da rota de empresa (garantido pelo middleware). */
export function usuarioDaEmpresa(c: Ctx): UsuarioDaEmpresa {
  const usuario = c.get("usuario");
  if (!usuario.empresa) throw new Error("Rota de empresa sem empresa na sessão.");
  return usuario as UsuarioDaEmpresa;
}

/** Só os dados que o navegador precisa (sem o id do login). */
export function paraNavegador({ userId: _, ...usuario }: Usuario): UsuarioLogado {
  return usuario;
}
