import { and, asc, eq } from "drizzle-orm";
import { deCentavos, lerValorEmReais, paraCentavos } from "@/compartilhado/formato";
import type { Produto, ProdutoCatalogo } from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { categoriasProduto, produtos } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

const CAMPOS = {
  id: produtos.id,
  nome: produtos.nome,
  categoriaId: produtos.categoriaId,
  categoriaNome: categoriasProduto.nome,
  unidade: produtos.unidade,
  precoSugerido: produtos.precoSugeridoCentavos,
  ativo: produtos.ativo,
};

/** Junta com o nome da categoria (pode não ter categoria, se ela foi excluída de outro jeito). */
const comCategoria = (db: Db) => db.select(CAMPOS).from(produtos).leftJoin(categoriasProduto, eq(categoriasProduto.id, produtos.categoriaId));

function paraCatalogo<T extends { categoriaId: string | null; categoriaNome: string | null }>({ categoriaId, categoriaNome, ...p }: T) {
  return { ...p, categoria: categoriaId && categoriaNome ? { id: categoriaId, nome: categoriaNome } : null };
}

/** Produtos ativos da empresa (os que aparecem na venda), agrupados por categoria. */
export async function catalogoAtivo(db: Db, u: UsuarioDaEmpresa): Promise<ProdutoCatalogo[]> {
  const linhas = await comCategoria(db)
    .where(and(eq(produtos.empresaId, u.empresa.id), eq(produtos.ativo, true)))
    .orderBy(asc(categoriasProduto.nome), asc(produtos.nome), asc(produtos.unidade));
  return linhas.map(({ ativo: _, precoSugerido, ...p }) => ({ ...paraCatalogo(p), precoSugerido: deCentavos(precoSugerido) }));
}

/** Catálogo: o master vê também os desativados; o revendedor, só os ativos. */
export async function listarProdutos(db: Db, u: UsuarioDaEmpresa): Promise<Produto[]> {
  const linhas = await comCategoria(db)
    .where(u.papel === "master" ? eq(produtos.empresaId, u.empresa.id) : and(eq(produtos.empresaId, u.empresa.id), eq(produtos.ativo, true)))
    .orderBy(asc(categoriasProduto.nome), asc(produtos.nome), asc(produtos.unidade));
  return linhas.map((p) => ({ ...paraCatalogo(p), precoSugerido: deCentavos(p.precoSugerido) }));
}

async function lerProduto(db: Db, u: UsuarioDaEmpresa, dados: { nome: string; categoriaId: string; unidade: string; preco: string }) {
  const preco = lerValorEmReais(dados.preco);
  if (!dados.nome) throw new ErroDeNegocio("Informe o nome do produto.");
  if (!dados.unidade) throw new ErroDeNegocio("Informe a unidade (ex.: pote 1 kg).");
  if (preco === null || preco < 0) throw new ErroDeNegocio("Informe um preço sugerido válido.");

  // A categoria precisa ser uma das cadastradas pela própria empresa (o gatilho confere de novo no banco).
  const categoria = await db
    .select({ id: categoriasProduto.id })
    .from(categoriasProduto)
    .where(and(eq(categoriasProduto.id, dados.categoriaId), eq(categoriasProduto.empresaId, u.empresa.id)))
    .get();
  if (!categoria) throw new ErroDeNegocio("Escolha a categoria do produto.");

  return { nome: dados.nome, categoriaId: dados.categoriaId, unidade: dados.unidade, precoSugeridoCentavos: paraCentavos(preco) };
}

export async function criarProduto(db: Db, u: UsuarioDaEmpresa, dados: { nome: string; categoriaId: string; unidade: string; preco: string }) {
  const produto = await lerProduto(db, u, dados);
  try {
    await db.insert(produtos).values({ ...produto, empresaId: u.empresa.id });
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
  return `${produto.nome} (${produto.unidade}) adicionado.`;
}

export async function alterarProduto(
  db: Db,
  u: UsuarioDaEmpresa,
  produtoId: string,
  dados: { nome: string; categoriaId: string; unidade: string; preco: string },
) {
  const produto = await lerProduto(db, u, dados);
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
