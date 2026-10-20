/** Painel do administrador da plataforma. */
import { Hono } from "hono";
import { esquemaAlterarEmpresa, esquemaAtivo, esquemaNovaEmpresa, esquemaNovoUsuario } from "@/compartilhado/esquemas";
import { exigirAdmin } from "../acesso";
import { validar } from "../erros";
import { adicionarMaster, alterarEmpresa, criarEmpresa, definirEmpresaAtiva, listarEmpresas, obterEmpresa } from "../servicos/empresas";
import { UUID } from "../servicos/vendas";
import type { AppEnv } from "../tipos";

export const rotasAdmin = new Hono<AppEnv>()
  .use("*", exigirAdmin)
  .get("/empresas", async (c) => c.json(await listarEmpresas(c.get("db"))))
  .post("/empresas", validar("json", esquemaNovaEmpresa), async (c) =>
    c.json(await criarEmpresa(c.get("db"), c.get("auth"), c.req.valid("json"))),
  )
  .get("/empresas/:id", async (c) => {
    const id = c.req.param("id");
    const empresa = UUID.test(id) ? await obterEmpresa(c.get("db"), id) : null;
    return empresa ? c.json(empresa) : c.json({ erro: "Empresa não encontrada." }, 404);
  })
  .put("/empresas/:id", validar("json", esquemaAlterarEmpresa), async (c) =>
    c.json({ sucesso: await alterarEmpresa(c.get("db"), c.req.param("id"), c.req.valid("json")) }),
  )
  .patch("/empresas/:id/ativa", validar("json", esquemaAtivo), async (c) =>
    c.json({ sucesso: await definirEmpresaAtiva(c.get("db"), c.req.param("id"), c.req.valid("json").ativo) }),
  )
  .post("/empresas/:id/masters", validar("json", esquemaNovoUsuario.omit({ endereco: true })), async (c) =>
    c.json(await adicionarMaster(c.get("db"), c.get("auth"), c.req.param("id"), c.req.valid("json"))),
  );
