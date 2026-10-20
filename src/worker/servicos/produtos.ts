import { and, asc, eq } from "drizzle-orm";
import { deCentavos, lerValorEmReais, paraCentavos } from "@/compartilhado/formato";
import type { Produto, ProdutoCatalogo } from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { produtos } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

const CAMPOS = {
  id: produtos.id,
  nome: produtos.nome,
  unidade: produtos.unidade,
  precoSugerido: produtos.precoSugeridoCentavos,
  ativo: produtos.ativo,
};

/** Produtos ativos da empresa (os que aparecem na venda). */
export async function catalogoAtivo(db: Db, u: UsuarioDaEmpresa): Promise<ProdutoCatalogo[]> {
  const linhas = await db
    .select(CAMPOS)
    .from(produtos)
    .where(and(eq(produtos.empresaId, u.empresa.id), eq(produtos.ativo, true)))
    .orderBy(asc(produtos.nome), asc(produtos.unidade));
  return linhas.map(({ ativo: _, precoSugerido, ...p }) => ({ ...p, precoSugerido: deCentavos(precoSugerido) }));
}

/** Catálogo: o master vê também os desativados; o revendedor, só os ativos. */
export async function listarProdutos(db: Db, u: UsuarioDaEmpresa): Promise<Produto[]> {
  const linhas = await db
    .select(CAMPOS)
    .from(produtos)
    .where(u.papel === "master" ? eq(produtos.empresaId, u.empresa.id) : and(eq(produtos.empresaId, u.empresa.id), eq(produtos.ativo, true)))
    .orderBy(asc(produtos.nome), asc(produtos.unidade));
  return linhas.map((p) => ({ ...p, precoSugerido: deCentavos(p.precoSugerido) }));
}

function lerProduto(dados: { nome: string; unidade: string; preco: string }) {
  const preco = lerValorEmReais(dados.preco);
  if (!dados.nome) throw new ErroDeNegocio("Informe o nome do produto.");
  if (!dados.unidade) throw new ErroDeNegocio("Informe a unidade (ex.: pote 1 kg).");
  if (preco === null || preco < 0) throw new ErroDeNegocio("Informe um preço sugerido válido.");
  return { nome: dados.nome, unidade: dados.unidade, precoSugeridoCentavos: paraCentavos(preco) };
}

export async function criarProduto(db: Db, u: UsuarioDaEmpresa, dados: { nome: string; unidade: string; preco: string }) {
  const produto = lerProduto(dados);
  try {
    await db.insert(produtos).values({ ...produto, empresaId: u.empresa.id });
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
  return `${produto.nome} (${produto.unidade}) adicionado.`;
}

export async function alterarProduto(db: Db, u: UsuarioDaEmpresa, produtoId: string, dados: { nome: string; unidade: string; preco: string }) {
  const produto = lerProduto(dados);
  let alterados: { id: string }[];
  try {
    alterados = await db
      .update(produtos)
      .set(produto)
      .where(and(eq(produtos.id, produtoId), eq(produtos.empresaId, u.empresa.id)))
      .returning({ id: produtos.id });
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
  if (alterados.length === 0) throw new ErroDeNegocio("Produto não encontrado.");
  return "Produto atualizado.";
}

export async function definirProdutoAtivo(db: Db, u: UsuarioDaEmpresa, produtoId: string, ativo: boolean) {
  const alterados = await db
    .update(produtos)
    .set({ ativo })
    .where(and(eq(produtos.id, produtoId), eq(produtos.empresaId, u.empresa.id)))
    .returning({ id: produtos.id });
  if (alterados.length === 0) throw new ErroDeNegocio("Produto não encontrado.");
  return ativo ? "Produto reativado." : "Produto desativado.";
}
