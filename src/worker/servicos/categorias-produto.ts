/** Categorias do catálogo de produtos (linhas como "Mel", "Própolis"): uma lista por empresa, que o master cria e exclui. */
import { and, asc, count, eq } from "drizzle-orm";
import type { CategoriaProduto } from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { categoriasProduto, produtos } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

export async function listarCategorias(db: Db, u: UsuarioDaEmpresa): Promise<CategoriaProduto[]> {
  return db
    .select({ id: categoriasProduto.id, nome: categoriasProduto.nome })
    .from(categoriasProduto)
    .where(eq(categoriasProduto.empresaId, u.empresa.id))
    .orderBy(asc(categoriasProduto.nome));
}

export async function criarCategoria(db: Db, u: UsuarioDaEmpresa, nome: string): Promise<CategoriaProduto> {
  if (!nome.trim()) throw new ErroDeNegocio("Informe o nome da categoria.");
  try {
    return await db.insert(categoriasProduto).values({ nome, empresaId: u.empresa.id }).returning({ id: categoriasProduto.id, nome: categoriasProduto.nome }).get();
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
}

/** Recusa a exclusão enquanto algum produto (ativo ou não) ainda estiver nessa categoria. */
export async function excluirCategoria(db: Db, u: UsuarioDaEmpresa, categoriaId: string) {
  const categoria = await db
    .select({ nome: categoriasProduto.nome })
    .from(categoriasProduto)
    .where(and(eq(categoriasProduto.id, categoriaId), eq(categoriasProduto.empresaId, u.empresa.id)))
    .get();
  if (!categoria) throw new ErroDeNegocio("Categoria não encontrada.");

  const emUso = await db
    .select({ total: count() })
    .from(produtos)
    .where(and(eq(produtos.categoriaId, categoriaId), eq(produtos.empresaId, u.empresa.id)))
    .get();
  if ((emUso?.total ?? 0) > 0) {
    throw new ErroDeNegocio(`A categoria "${categoria.nome}" tem produtos cadastrados. Mude a categoria desses produtos antes de excluir.`);
  }

  await db.delete(categoriasProduto).where(and(eq(categoriasProduto.id, categoriaId), eq(categoriasProduto.empresaId, u.empresa.id)));
  return `Categoria "${categoria.nome}" excluída.`;
}

/** As categorias iniciais de uma empresa nova (o master edita ou exclui dali em diante). */
export async function criarCategoriasIniciais(db: Db, empresaId: string, nomes: readonly string[]) {
  if (nomes.length === 0) return;
  await db.insert(categoriasProduto).values(nomes.map((nome) => ({ nome, empresaId })));
}
