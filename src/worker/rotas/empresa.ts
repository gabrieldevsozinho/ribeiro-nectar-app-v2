/**
 * Rotas da área de uma empresa: /api/e/:slug/...
 * Todas passam por exigirUsuarioDaEmpresa; as do master também por exigirMaster.
 * Os serviços recebem o usuário da sessão e só enxergam a empresa dele.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import {
  esquemaAcrescentarItens,
  esquemaAtivo,
  esquemaBloqueio,
  esquemaCodigo,
  esquemaFalhaMaps,
  esquemaGeocodificar,
  esquemaLocalizacao,
  esquemaNovaSenha,
  esquemaNovoUsuario,
  esquemaPerfil,
  esquemaPonto,
  esquemaPrazos,
  esquemaProduto,
  esquemaRegistrarVenda,
  esquemaSalvarChave,
  esquemaTrocarSenha,
} from "@/compartilhado/esquemas";
import { EXCLUSAO_DE_REVENDEDOR_LIGADA } from "@/compartilhado/recursos";
import type { DadosMapa, FiltrosVendasDisponiveis } from "@/compartilhado/tipos";
import { exigirMaster, exigirUsuarioDaEmpresa, paraNavegador, usuarioDaEmpresa } from "../acesso";
import { perfis } from "../db/esquema";
import { validar } from "../erros";
import {
  configMapaCliente,
  obterConfigGoogleMaps,
  removerChaveMaps,
  reportarFalhaMaps,
  salvarChaveMaps,
  statusParaAviso,
} from "../servicos/google-maps";
import { geocodificarEndereco } from "../servicos/nominatim";
import { obterPerfil, salvarPerfil, trocarSenha, trocarSenhaInicial } from "../servicos/perfil";
import {
  alterarPonto,
  buscarPontos,
  cidadesCadastradas,
  criarPonto,
  definirLocalizacao,
  listarPontos,
  marcarNaoEncontrado,
  obterPonto,
  pontosPendentes,
  resumoPendentes,
} from "../servicos/pontos";
import { obterPrazos, salvarPrazos } from "../servicos/prazos-visita";
import { alterarProduto, criarProduto, definirProdutoAtivo, listarProdutos } from "../servicos/produtos";
import {
  confirmarExclusao,
  criarRevendedor,
  definirBloqueio,
  listarRevendedores,
  obterRevendedor,
  solicitarCodigoExclusao,
} from "../servicos/revendedores";
import {
  acrescentarItens,
  cidadesComVendas,
  dadosNovaVenda,
  listarVendas,
  obterVenda,
  pontosComVendas,
  registrarVenda,
  resumoVendedores,
  vendasDoPonto,
} from "../servicos/vendas";
import type { AppEnv } from "../tipos";

const naoEncontrado = { erro: "Não encontrado." };
const exclusaoDesligada = { erro: "A exclusão de revendedores está desligada no momento. Para tirar o acesso, use “Bloquear acesso”." };

/** Rotas que valem também antes da troca da senha temporária. */
const comTrocaPendente = exigirUsuarioDaEmpresa({ permitirTrocaPendente: true });

export const rotasAcessoInicial = new Hono<AppEnv>()
  .get("/eu", comTrocaPendente, (c) => c.json(paraNavegador(c.get("usuario"))))
  .post("/primeiro-acesso", comTrocaPendente, validar("json", esquemaNovaSenha), async (c) => {
    const usuario = usuarioDaEmpresa(c);
    if (!usuario.deveTrocarSenha) return c.json({ destino: `/${usuario.empresa.slug}/vendas` });
    await trocarSenhaInicial(c.get("db"), c.get("auth"), usuario, c.req.valid("json"));
    return c.json({ destino: `/${usuario.empresa.slug}/vendas` });
  });

export const rotasEmpresa = new Hono<AppEnv>()
  .use("*", exigirUsuarioDaEmpresa())

  // --- Mapa ----------------------------------------------------------------------
  .get("/config-mapa", async (c) => c.json(await configMapaCliente(c.env, c.get("db"), usuarioDaEmpresa(c))))
  .get("/aviso-maps", async (c) => c.json({ status: await statusParaAviso(c.env, c.get("db"), usuarioDaEmpresa(c)) }))
  .get("/mapa", async (c) => {
    const u = usuarioDaEmpresa(c);
    const db = c.get("db");
    const [pontos, prazos, pendentes] = await Promise.all([
      pontosComVendas(db, u),
      obterPrazos(db, u),
      u.papel === "master" ? resumoPendentes(db, u) : { aLocalizar: 0, naoEncontrados: [] },
    ]);
    return c.json<DadosMapa>({ pontos, prazos, pendentes });
  })
  .put("/mapa/prazos", exigirMaster, validar("json", esquemaPrazos), async (c) =>
    c.json({ sucesso: await salvarPrazos(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json")) }),
  )
  .post("/geocodificar", validar("json", esquemaGeocodificar), async (c) =>
    c.json(await geocodificarEndereco(c.env, c.req.valid("json"))),
  )

  // --- Vendas --------------------------------------------------------------------
  .get("/vendas", async (c) => {
    const u = usuarioDaEmpresa(c);
    const q = c.req.query();
    const filtros = { de: q.de, ate: q.ate, vendedorId: u.papel === "master" ? q.vendedor : undefined, cidade: q.cidade };
    return c.json(await listarVendas(c.get("db"), u, filtros, Number(q.pagina) || 1));
  })
  .get("/vendas/filtros", async (c) => {
    const u = usuarioDaEmpresa(c);
    const db = c.get("db");
    const [cidades, resumo] = await Promise.all([cidadesComVendas(db, u), u.papel === "master" ? resumoVendedores(db, u) : null]);
    // Só aparecem no filtro os vendedores com vendas visíveis para este master.
    const ids = resumo ? [...resumo.keys()] : [];
    const vendedores = ids.length
      ? await db
          .select({ id: perfis.id, nome: perfis.nome })
          .from(perfis)
          .where(and(eq(perfis.empresaId, u.empresa.id), inArray(perfis.id, ids)))
          .orderBy(asc(perfis.nome))
      : [];
    return c.json<FiltrosVendasDisponiveis>({ cidades, vendedores });
  })
  .get("/vendas/nova", async (c) => c.json(await dadosNovaVenda(c.get("db"), usuarioDaEmpresa(c), c.req.query("ponto"))))
  .post("/vendas", validar("json", esquemaRegistrarVenda), async (c) =>
    c.json({ id: await registrarVenda(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json")) }),
  )
  .get("/vendas/:id", async (c) => {
    const venda = await obterVenda(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"));
    return venda ? c.json(venda) : c.json(naoEncontrado, 404);
  })
  .post("/vendas/:id/itens", validar("json", esquemaAcrescentarItens), async (c) =>
    c.json({ sucesso: await acrescentarItens(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json").itens) }),
  )

  // --- Pontos de venda -----------------------------------------------------------
  .get("/pontos", async (c) => c.json(await listarPontos(c.get("db"), usuarioDaEmpresa(c), c.req.query("q") ?? "")))
  .get("/pontos/busca", async (c) => c.json(await buscarPontos(c.get("db"), usuarioDaEmpresa(c), c.req.query("termo") ?? "")))
  .get("/pontos/cidades", async (c) => c.json(await cidadesCadastradas(c.get("db"), usuarioDaEmpresa(c))))
  .get("/pontos/pendentes", exigirMaster, async (c) =>
    c.json(await pontosPendentes(c.get("db"), usuarioDaEmpresa(c), c.req.query("todos") === "1")),
  )
  .post("/pontos", validar("json", esquemaPonto), async (c) =>
    c.json({ id: await criarPonto(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json")) }),
  )
  .get("/pontos/:id", async (c) => {
    const ponto = await obterPonto(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"));
    return ponto ? c.json(ponto) : c.json(naoEncontrado, 404);
  })
  .put("/pontos/:id", validar("json", esquemaPonto), async (c) => {
    await alterarPonto(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json"));
    return c.json({ id: c.req.param("id") });
  })
  .patch("/pontos/:id/localizacao", validar("json", esquemaLocalizacao), async (c) => {
    await definirLocalizacao(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json"));
    return c.json({ ok: true });
  })
  .post("/pontos/:id/localizacao/nao-encontrada", exigirMaster, async (c) => {
    await marcarNaoEncontrado(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"));
    return c.json({ ok: true });
  })
  .get("/pontos/:id/vendas", async (c) =>
    c.json(await vendasDoPonto(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"), Number(c.req.query("pagina")) || 1)),
  )

  // --- Produtos ------------------------------------------------------------------
  .get("/produtos", async (c) => c.json(await listarProdutos(c.get("db"), usuarioDaEmpresa(c))))
  .post("/produtos", exigirMaster, validar("json", esquemaProduto), async (c) =>
    c.json({ sucesso: await criarProduto(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json")) }),
  )
  .put("/produtos/:id", exigirMaster, validar("json", esquemaProduto), async (c) =>
    c.json({ sucesso: await alterarProduto(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json")) }),
  )
  .patch("/produtos/:id/ativo", exigirMaster, validar("json", esquemaAtivo), async (c) =>
    c.json({ sucesso: await definirProdutoAtivo(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json").ativo) }),
  )

  // --- Google Maps ---------------------------------------------------------------
  .get("/google-maps", exigirMaster, async (c) => c.json(await obterConfigGoogleMaps(c.env, c.get("db"), usuarioDaEmpresa(c))))
  .put("/google-maps", exigirMaster, validar("json", esquemaSalvarChave), async (c) => {
    const { ok, mensagem } = await salvarChaveMaps(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json"));
    return ok ? c.json({ sucesso: mensagem }) : c.json({ erro: mensagem }, 422);
  })
  .delete("/google-maps", exigirMaster, async (c) => c.json({ sucesso: await removerChaveMaps(c.get("db"), usuarioDaEmpresa(c)) }))
  .post("/google-maps/falha", validar("json", esquemaFalhaMaps), async (c) => {
    await reportarFalhaMaps(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json").resultado);
    return c.json({ ok: true });
  })

  // --- Revendedores (master) -----------------------------------------------------
  .get("/revendedores", exigirMaster, async (c) => c.json(await listarRevendedores(c.get("db"), usuarioDaEmpresa(c))))
  .post("/revendedores", exigirMaster, validar("json", esquemaNovoUsuario), async (c) =>
    c.json(await criarRevendedor(c.get("db"), c.get("auth"), usuarioDaEmpresa(c), c.req.valid("json"))),
  )
  .get("/revendedores/:id", exigirMaster, async (c) => {
    const detalhe = await obterRevendedor(c.get("db"), usuarioDaEmpresa(c), c.req.param("id"));
    return detalhe ? c.json(detalhe) : c.json(naoEncontrado, 404);
  })
  .patch("/revendedores/:id/bloqueio", exigirMaster, validar("json", esquemaBloqueio), async (c) =>
    c.json({
      sucesso: await definirBloqueio(c.get("db"), c.get("auth"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json").bloquear),
    }),
  )
  .post("/revendedores/:id/codigo-exclusao", exigirMaster, async (c) => {
    if (!EXCLUSAO_DE_REVENDEDOR_LIGADA) return c.json(exclusaoDesligada, 422);
    return c.json(await solicitarCodigoExclusao(c.env, c.get("db"), usuarioDaEmpresa(c), c.req.param("id")));
  })
  .post("/revendedores/:id/exclusao", exigirMaster, validar("json", esquemaCodigo), async (c) => {
    if (!EXCLUSAO_DE_REVENDEDOR_LIGADA) return c.json(exclusaoDesligada, 422);
    await confirmarExclusao(c.env, c.get("db"), c.get("auth"), usuarioDaEmpresa(c), c.req.param("id"), c.req.valid("json").codigo);
    return c.json({ ok: true });
  })

  // --- Meu perfil ----------------------------------------------------------------
  .get("/perfil", async (c) => {
    const perfil = await obterPerfil(c.get("db"), usuarioDaEmpresa(c));
    return perfil ? c.json(perfil) : c.json(naoEncontrado, 404);
  })
  .put("/perfil", validar("json", esquemaPerfil), async (c) =>
    c.json({ sucesso: await salvarPerfil(c.get("db"), usuarioDaEmpresa(c), c.req.valid("json")) }),
  )
  .post("/perfil/senha", validar("json", esquemaTrocarSenha), async (c) =>
    c.json({ sucesso: await trocarSenha(c.get("auth"), c.req.raw.headers, c.req.valid("json")) }),
  );
