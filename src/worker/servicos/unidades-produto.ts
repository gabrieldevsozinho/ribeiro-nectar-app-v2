/** Unidades do catálogo de produtos (tamanhos como "pote 1 kg", "frasco 30 ml"): uma lista por empresa, que o master cria e exclui. */
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { UnidadeProduto } from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { produtos, unidadesProduto } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

export async function listarUnidades(db: Db, u: UsuarioDaEmpresa): Promise<UnidadeProduto[]> {
  return db
    .select({ id: unidadesProduto.id, nome: unidadesProduto.nome })
    .from(unidadesProduto)
    .where(eq(unidadesProduto.empresaId, u.empresa.id))
    .orderBy(asc(unidadesProduto.nome));
}

export async function criarUnidade(db: Db, u: UsuarioDaEmpresa, nome: string): Promise<UnidadeProduto> {
  if (!nome.trim()) throw new ErroDeNegocio("Informe o nome da unidade.");
  try {
    return await db
      .insert(unidadesProduto)
      .values({ nome, empresaId: u.empresa.id })
      .returning({ id: unidadesProduto.id, nome: unidadesProduto.nome })
      .get();
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
}

/** Recusa a exclusão enquanto algum produto (ativo ou não) ainda usar essa unidade. */
export async function excluirUnidade(db: Db, u: UsuarioDaEmpresa, unidadeId: string) {
  const unidade = await db
    .select({ nome: unidadesProduto.nome })
    .from(unidadesProduto)
    .where(and(eq(unidadesProduto.id, unidadeId), eq(unidadesProduto.empresaId, u.empresa.id)))
    .get();
  if (!unidade) throw new ErroDeNegocio("Unidade não encontrada.");

  const emUso = await db
    .select({ total: count() })
    .from(produtos)
    .where(and(eq(produtos.empresaId, u.empresa.id), sql`lower(trim(${produtos.unidade})) = lower(trim(${unidade.nome}))`))
    .get();
  if ((emUso?.total ?? 0) > 0) {
    throw new ErroDeNegocio(`A unidade "${unidade.nome}" está em uso por produtos cadastrados. Mude a unidade desses produtos antes de excluir.`);
  }

  await db.delete(unidadesProduto).where(and(eq(unidadesProduto.id, unidadeId), eq(unidadesProduto.empresaId, u.empresa.id)));
  return `Unidade "${unidade.nome}" excluída.`;
}

/** As unidades iniciais de uma empresa nova (o master edita ou exclui dali em diante). */
export async function criarUnidadesIniciais(db: Db, empresaId: string, nomes: readonly string[]) {
  if (nomes.length === 0) return;
  await db.insert(unidadesProduto).values(nomes.map((nome) => ({ nome, empresaId })));
}
