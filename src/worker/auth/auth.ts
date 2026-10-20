import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "../db/cliente";
import { authContas, authLimites, authSessoes, authUsuarios, authVerificacoes } from "../db/esquema";
import { conferirSenha, gerarHashSenha } from "./senha-hash";

/**
 * Login com e-mail e senha (Better Auth). Ninguém se cadastra sozinho: os usuários
 * são criados pelo admin da plataforma (masters) e pelos masters (revendedores),
 * via src/worker/servicos/usuarios.ts.
 */
export function criarAuth(env: Env, db: Db) {
  const desenvolvimento = env.AMBIENTE === "desenvolvimento";
  return betterAuth({
    appName: "Ribeiro Néctar",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: authUsuarios,
        session: authSessoes,
        account: authContas,
        verification: authVerificacoes,
        rateLimit: authLimites,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: { hash: gerarHashSenha, verify: conferirSenha },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 dias
      updateAge: 60 * 60 * 24, // renova uma vez por dia de uso
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        // Tentativas de login por IP: no máximo 10 por minuto (mais folga no ambiente local, para os testes).
        "/sign-in/email": { window: 60, max: desenvolvimento ? 100 : 10 },
      },
    },
    advanced: {
      useSecureCookies: !desenvolvimento,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof criarAuth>;
