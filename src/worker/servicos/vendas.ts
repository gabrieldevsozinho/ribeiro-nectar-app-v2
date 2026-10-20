import { and, asc, count, countDistinct, desc, eq, gte, inArray, lt, max, or, sql, sum, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { deCentavos, deMilesimos, paraCentavos, paraMilesimos } from "@/compartilhado/formato";
import type {
  CidadeComVendas,
  DadosNovaVenda,
  ItemNovo,
  ItemResumo,
  ListaVendas,
  PaginaVendas,
  PontoComVendas,
  PontoEscolha,
  ResumoVendedor,
  VendaDetalhe,
  VendaResumo,
} from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { itensVenda, perfis, pontosVenda, produtos, vendas } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";
import { catalogoAtivo } from "./produtos";

export const VENDAS_POR_PAGINA = 10;
export const VENDAS_POR_PAGINA_LISTA = 20;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Vendas que o usuário pode ver (a mesma regra do RLS do projeto original):
 * - revendedor: só as próprias;
 * - master: as próprias, as dos revendedores (inclusive os removidos) e as dos masters que compartilham.
 * Toda consulta de vendas passa por aqui.
 */
export function vendasVisiveis(db: Db, u: UsuarioDaEmpresa): SQL {
  const daEmpresa = eq(vendas.empresaId, u.empresa.id);
  if (u.papel !== "master") return and(daEmpresa, eq(vendas.vendedorId, u.perfilId))!;

  const vendedoresVisiveis = db
    .select({ id: perfis.id })
    .from(perfis)
    .where(and(eq(perfis.empresaId, u.empresa.id), or(eq(perfis.papel, "revendedor"), eq(perfis.compartilhaVendas, true))));
  return and(daEmpresa, or(eq(vendas.vendedorId, u.perfilId), inArray(vendas.vendedorId, vendedoresVisiveis)))!;
}

const paginaSegura = (pagina: number) => Math.max(1, Math.floor(pagina) || 1);

// Leituras com junção usam Promise.all, não db.batch: no lote do D1, o Drizzle lê as linhas
// pelo nome da coluna, e colunas repetidas (id, nome) de tabelas diferentes se misturam.
// O db.batch fica para gravações que precisam ser atômicas.

/** Itens das vendas, na ordem em que foram acrescentados. */
async function carregarItens(db: Db, vendaIds: string[]) {
  const porVenda = new Map<string, (ItemResumo & { id: string; adicionadoEm: string })[]>();
  if (vendaIds.length === 0) return porVenda;
  const linhas = await db
    .select({
      vendaId: itensVenda.vendaId,
      id: itensVenda.id,
      quantidade: itensVenda.quantidadeMilesimos,
      preco: itensVenda.precoUnitarioCentavos,
      subtotal: itensVenda.subtotalCentavos,
      adicionadoEm: itensVenda.adicionadoEm,
      produto: produtos.nome,
      unidade: produtos.unidade,
    })
    .from(itensVenda)
    .innerJoin(produtos, eq(produtos.id, itensVenda.produtoId))
    .where(inArray(itensVenda.vendaId, vendaIds))
    .orderBy(asc(itensVenda.adicionadoEm), sql`itens_venda.rowid`);
  for (const l of linhas) {
    const lista = porVenda.get(l.vendaId) ?? [];
    lista.push({
      id: l.id,
      produto: l.produto,
      unidade: l.unidade,
      quantidade: deMilesimos(l.quantidade),
      precoUnitario: deCentavos(l.preco),
      subtotal: deCentavos(l.subtotal),
      adicionadoEm: l.adicionadoEm,
    });
    porVenda.set(l.vendaId, lista);
  }
  return porVenda;
}

const CAMPOS_RESUMO = {
  id: vendas.id,
  dataVenda: vendas.dataVenda,
  valorTotal: vendas.valorTotalCentavos,
  vendedor: perfis.nome,
  pontoId: pontosVenda.id,
  pontoNome: pontosVenda.nome,
  cidade: pontosVenda.cidade,
  uf: pontosVenda.uf,
};

type LinhaResumo = { id: string; dataVenda: string; valorTotal: number; vendedor: string; pontoId: string; pontoNome: string; cidade: string; uf: string };

async function montarResumos(db: Db, linhas: LinhaResumo[]): Promise<VendaResumo[]> {
  const itens = await carregarItens(
    db,
    linhas.map((l) => l.id),
  );
  return linhas.map((l) => ({
    id: l.id,
    dataVenda: l.dataVenda,
    valorTotal: deCentavos(l.valorTotal),
    vendedor: l.vendedor,
    ponto: { id: l.pontoId, nome: l.pontoNome, cidade: l.cidade, uf: l.uf },
    itens: (itens.get(l.id) ?? []).map(({ produto, unidade, quantidade, precoUnitario, subtotal }) => ({
      produto,
      unidade,
      quantidade,
      precoUnitario,
      subtotal,
    })),
  }));
}

export type FiltrosVendas = {
  /** AAAA-MM-DD, no fuso de Brasília. */
  de?: string;
  ate?: string;
  vendedorId?: string;
  /** "Cidade|UF" */
  cidade?: string;
};

/** Lista de vendas com filtros e o total do filtro. */
export async function listarVendas(db: Db, u: UsuarioDaEmpresa, filtros: FiltrosVendas, pagina: number): Promise<ListaVendas> {
  const numero = paginaSegura(pagina);
  const [cidade, uf] = (filtros.cidade ?? "").split("|");

  const condicoes: SQL[] = [vendasVisiveis(db, u)];
  if (filtros.de && DATA.test(filtros.de)) {
    condicoes.push(gte(vendas.dataVenda, new Date(`${filtros.de}T00:00:00-03:00`).toISOString()));
  }
  if (filtros.ate && DATA.test(filtros.ate)) {
    const fim = new Date(`${filtros.ate}T00:00:00-03:00`);
    fim.setUTCDate(fim.getUTCDate() + 1);
    condicoes.push(lt(vendas.dataVenda, fim.toISOString()));
  }
  if (filtros.vendedorId && UUID.test(filtros.vendedorId)) condicoes.push(eq(vendas.vendedorId, filtros.vendedorId));
  if (cidade && uf) condicoes.push(eq(pontosVenda.cidade, cidade), eq(pontosVenda.uf, uf));
  const onde = and(...condicoes);

  const [linhas, totais] = await Promise.all([
    db
      .select(CAMPOS_RESUMO)
      .from(vendas)
      .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
      .innerJoin(perfis, eq(perfis.id, vendas.vendedorId))
      .where(onde)
      .orderBy(desc(vendas.dataVenda), desc(vendas.id))
      .limit(VENDAS_POR_PAGINA_LISTA)
      .offset((numero - 1) * VENDAS_POR_PAGINA_LISTA),
    db
      .select({ total: count(), soma: sum(vendas.valorTotalCentavos) })
      .from(vendas)
      .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
      .where(onde),
  ]);

  const total = totais[0]?.total ?? 0;
  return {
    vendas: await montarResumos(db, linhas),
    total,
    soma: deCentavos(Number(totais[0]?.soma ?? 0)),
    pagina: numero,
    paginas: Math.max(1, Math.ceil(total / VENDAS_POR_PAGINA_LISTA)),
  };
}

/** Vendas de um ponto, 10 por página, das mais recentes para as mais antigas. */
export async function vendasDoPonto(db: Db, u: UsuarioDaEmpresa, pontoId: string, pagina: number): Promise<PaginaVendas> {
  const numero = paginaSegura(pagina);
  const onde = and(vendasVisiveis(db, u), eq(vendas.pontoVendaId, pontoId));
  const [linhas, totais] = await Promise.all([
    db
      .select(CAMPOS_RESUMO)
      .from(vendas)
      .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
      .innerJoin(perfis, eq(perfis.id, vendas.vendedorId))
      .where(onde)
      .orderBy(desc(vendas.dataVenda), desc(vendas.id))
      .limit(VENDAS_POR_PAGINA)
      .offset((numero - 1) * VENDAS_POR_PAGINA),
    db.select({ total: count() }).from(vendas).where(onde),
  ]);
  const total = totais[0]?.total ?? 0;
  return {
    vendas: await montarResumos(db, linhas),
    total,
    pagina: numero,
    paginas: Math.max(1, Math.ceil(total / VENDAS_POR_PAGINA)),
  };
}

/** Uma venda (se o usuário puder vê-la), com os itens na ordem em que foram acrescentados. */
export async function obterVenda(db: Db, u: UsuarioDaEmpresa, id: string): Promise<VendaDetalhe | null> {
  if (!UUID.test(id)) return null;
  const venda = await db
    .select({
      id: vendas.id,
      dataVenda: vendas.dataVenda,
      valorTotal: vendas.valorTotalCentavos,
      observacao: vendas.observacao,
      vendedorId: vendas.vendedorId,
      vendedor: perfis.nome,
      ponto: {
        id: pontosVenda.id,
        nome: pontosVenda.nome,
        logradouro: pontosVenda.logradouro,
        numero: pontosVenda.numero,
        bairro: pontosVenda.bairro,
        cidade: pontosVenda.cidade,
        uf: pontosVenda.uf,
        latitude: pontosVenda.latitude,
        longitude: pontosVenda.longitude,
      },
    })
    .from(vendas)
    .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
    .innerJoin(perfis, eq(perfis.id, vendas.vendedorId))
    .where(and(vendasVisiveis(db, u), eq(vendas.id, id)))
    .get();
  if (!venda) return null;

  const ehMinha = venda.vendedorId === u.perfilId;
  const [itens, catalogo] = await Promise.all([carregarItens(db, [venda.id]), ehMinha ? catalogoAtivo(db, u) : []]);
  return {
    id: venda.id,
    dataVenda: venda.dataVenda,
    valorTotal: deCentavos(venda.valorTotal),
    observacao: venda.observacao,
    vendedor: venda.vendedor,
    ehMinha,
    ponto: venda.ponto,
    itens: itens.get(venda.id) ?? [],
    produtos: catalogo,
  };
}

/** Cidades onde há vendas visíveis para quem está logado. */
export async function cidadesComVendas(db: Db, u: UsuarioDaEmpresa): Promise<CidadeComVendas[]> {
  const linhas = await db
    .select({
      cidade: pontosVenda.cidade,
      uf: pontosVenda.uf,
      pontos: countDistinct(pontosVenda.id),
      vendas: count(vendas.id),
      ultimaVenda: max(vendas.dataVenda),
    })
    .from(vendas)
    .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
    .where(vendasVisiveis(db, u))
    .groupBy(pontosVenda.cidade, pontosVenda.uf)
    .orderBy(asc(pontosVenda.uf), asc(pontosVenda.cidade));
  return linhas.map((l) => ({ ...l, ultimaVenda: l.ultimaVenda ?? "" }));
}

/** Pontos com vendas visíveis (para o mapa e o menu de cidades). */
export async function pontosComVendas(db: Db, u: UsuarioDaEmpresa): Promise<PontoComVendas[]> {
  const linhas = await db
    .select({
      id: pontosVenda.id,
      nome: pontosVenda.nome,
      logradouro: pontosVenda.logradouro,
      numero: pontosVenda.numero,
      bairro: pontosVenda.bairro,
      cidade: pontosVenda.cidade,
      uf: pontosVenda.uf,
      latitude: pontosVenda.latitude,
      longitude: pontosVenda.longitude,
      localizacaoStatus: pontosVenda.localizacaoStatus,
      vendas: count(vendas.id),
      valorTotal: sum(vendas.valorTotalCentavos),
      ultimaVenda: max(vendas.dataVenda),
    })
    .from(vendas)
    .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
    .where(vendasVisiveis(db, u))
    .groupBy(pontosVenda.id)
    .orderBy(asc(pontosVenda.nome));
  return linhas.map((l) => ({ ...l, valorTotal: deCentavos(Number(l.valorTotal ?? 0)), ultimaVenda: l.ultimaVenda ?? "" }));
}

/** Resumo de vendas por vendedor (lista de revendedores e filtro de vendedores do master). */
export async function resumoVendedores(db: Db, u: UsuarioDaEmpresa): Promise<Map<string, ResumoVendedor>> {
  const linhas = await db
    .select({
      vendedorId: vendas.vendedorId,
      vendas: count(),
      valorTotal: sum(vendas.valorTotalCentavos),
      ultimaVenda: max(vendas.dataVenda),
    })
    .from(vendas)
    .where(vendasVisiveis(db, u))
    .groupBy(vendas.vendedorId);
  return new Map(
    linhas.map((l) => [l.vendedorId, { vendas: l.vendas, valorTotal: deCentavos(Number(l.valorTotal ?? 0)), ultimaVenda: l.ultimaVenda ?? "" }]),
  );
}

const CAMPOS_PONTO = {
  id: pontosVenda.id,
  nome: pontosVenda.nome,
  logradouro: pontosVenda.logradouro,
  numero: pontosVenda.numero,
  bairro: pontosVenda.bairro,
  cidade: pontosVenda.cidade,
  uf: pontosVenda.uf,
};

/** Dados da tela de nova venda: catálogo ativo, o ponto vindo da URL e os 5 últimos comércios onde o usuário vendeu. */
export async function dadosNovaVenda(db: Db, u: UsuarioDaEmpresa, pontoId: string | undefined): Promise<DadosNovaVenda> {
  const [catalogo, pontoInicial, ultimas] = await Promise.all([
    catalogoAtivo(db, u),
    pontoId && UUID.test(pontoId)
      ? db
          .select(CAMPOS_PONTO)
          .from(pontosVenda)
          .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id)))
          .get()
      : undefined,
    db
      .select(CAMPOS_PONTO)
      .from(vendas)
      .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
      .where(and(eq(vendas.empresaId, u.empresa.id), eq(vendas.vendedorId, u.perfilId)))
      .orderBy(desc(vendas.dataVenda))
      .limit(30),
  ]);

  const recentes: PontoEscolha[] = [];
  for (const p of ultimas) {
    if (!recentes.some((r) => r.id === p.id)) recentes.push(p);
    if (recentes.length === 5) break;
  }
  return { produtos: catalogo, pontoInicial: pontoInicial ?? null, recentes };
}

function validarItens(itens: ItemNovo[]): string | null {
  if (!Array.isArray(itens) || itens.length === 0) return "Adicione pelo menos um item.";
  if (itens.length > 50) return "No máximo 50 itens por vez.";
  for (const item of itens) {
    if (!UUID.test(item.produtoId)) return "Produto inválido.";
    if (!(item.quantidade > 0) || item.quantidade > 100_000 || paraMilesimos(item.quantidade) <= 0) return "Confira as quantidades.";
    if (!(item.precoUnitario >= 0) || item.precoUnitario > 1_000_000) return "Confira os preços.";
  }
  return null;
}

/** Linhas de itens para gravar (a empresa vem da sessão; o banco confere de novo). */
function linhasDeItens(u: UsuarioDaEmpresa, vendaId: string, itens: ItemNovo[]) {
  return itens.map((i) => ({
    vendaId,
    empresaId: u.empresa.id,
    produtoId: i.produtoId,
    quantidadeMilesimos: paraMilesimos(i.quantidade),
    precoUnitarioCentavos: paraCentavos(i.precoUnitario),
    adicionadoPor: u.perfilId,
  }));
}

/** Grava a venda e os itens de uma vez (lote atômico do D1: ou entra tudo, ou nada). */
export async function registrarVenda(
  db: Db,
  u: UsuarioDaEmpresa,
  dados: { pontoId: string; itens: ItemNovo[]; observacao: string },
): Promise<string> {
  if (!UUID.test(dados.pontoId)) throw new ErroDeNegocio("Escolha o ponto de venda.");
  const problema = validarItens(dados.itens);
  if (problema) throw new ErroDeNegocio(problema);

  const ponto = await db
    .select({ id: pontosVenda.id })
    .from(pontosVenda)
    .where(and(eq(pontosVenda.id, dados.pontoId), eq(pontosVenda.empresaId, u.empresa.id)))
    .get();
  if (!ponto) throw new ErroDeNegocio("Escolha o ponto de venda.");

  const vendaId = crypto.randomUUID();
  const observacao = dados.observacao.trim().slice(0, 500) || null;
  const comandos: BatchItem<"sqlite">[] = [
    db.insert(vendas).values({ id: vendaId, empresaId: u.empresa.id, pontoVendaId: ponto.id, vendedorId: u.perfilId, observacao }),
    ...linhasDeItens(u, vendaId, dados.itens).map((linha) => db.insert(itensVenda).values(linha)),
  ];
  try {
    await db.batch(comandos as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
  return vendaId;
}

/** Acrescenta itens a uma venda própria. O que já foi vendido não muda. */
export async function acrescentarItens(db: Db, u: UsuarioDaEmpresa, vendaId: string, itens: ItemNovo[]): Promise<string> {
  if (!UUID.test(vendaId)) throw new ErroDeNegocio("Venda inválida.");
  const problema = validarItens(itens);
  if (problema) throw new ErroDeNegocio(problema);

  const venda = await db
    .select({ id: vendas.id })
    .from(vendas)
    .where(and(eq(vendas.id, vendaId), eq(vendas.empresaId, u.empresa.id), eq(vendas.vendedorId, u.perfilId)))
    .get();
  if (!venda) throw new ErroDeNegocio("Só quem registrou a venda pode acrescentar itens.");

  const comandos: BatchItem<"sqlite">[] = linhasDeItens(u, vendaId, itens).map((linha) => db.insert(itensVenda).values(linha));
  try {
    await db.batch(comandos as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
  return itens.length === 1 ? "Item acrescentado à venda." : `${itens.length} itens acrescentados à venda.`;
}
