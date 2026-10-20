import type { Context } from "hono";
import type { Auth } from "./auth/auth";
import type { Db } from "./db/cliente";
import type { Sessao, Usuario } from "./acesso";

/** Tipos do Hono: bindings do Cloudflare e o que cada requisição guarda pelo caminho. */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    auth: Auth;
    /** Lida uma vez por requisição (veja obterSessao). */
    sessao?: Sessao;
    /** Preenchido pelos middlewares exigir*: quem está logado e pode estar ali. */
    usuario: Usuario;
  };
};

export type Ctx = Context<AppEnv>;

/** Usuário de empresa (master ou revendedor): sempre tem empresa. */
export type UsuarioDaEmpresa = Usuario & { empresa: NonNullable<Usuario["empresa"]> };
