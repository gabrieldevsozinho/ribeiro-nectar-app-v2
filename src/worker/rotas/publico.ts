/** Rotas sem login: dados mínimos para a página inicial e as telas de login. */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { COOKIE_ULTIMA_EMPRESA, slugValido } from "@/compartilhado/slug";
import type { EmpresaPublica, UltimaEmpresa } from "@/compartilhado/tipos";
import { empresas } from "../db/esquema";
import type { AppEnv } from "../tipos";

export const rotasPublicas = new Hono<AppEnv>()
  /** Nome da empresa e se está ativa (tela de login da empresa). */
  .get("/empresas/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!slugValido(slug)) return c.json({ erro: "Empresa não encontrada." }, 404);
    const empresa = await c
      .get("db")
      .select({ nome: empresas.nome, ativa: empresas.ativa })
      .from(empresas)
      .where(eq(empresas.slug, slug))
      .get();
    if (!empresa) return c.json({ erro: "Empresa não encontrada." }, 404);
    return c.json<EmpresaPublica>(empresa);
  })

  /** Última empresa acessada neste aparelho (atalho na página inicial e abertura do app instalado). */
  .get("/ultima-empresa", async (c) => {
    const slug = getCookie(c, COOKIE_ULTIMA_EMPRESA);
    if (!slug || !slugValido(slug)) return c.json<UltimaEmpresa>(null);
    const empresa = await c
      .get("db")
      .select({ nome: empresas.nome, ativa: empresas.ativa })
      .from(empresas)
      .where(eq(empresas.slug, slug))
      .get();
    return c.json<UltimaEmpresa>(empresa?.ativa ? { slug, nome: empresa.nome } : null);
  });
