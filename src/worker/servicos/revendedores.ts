import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { deCentavos, paraComparar } from "@/compartilhado/formato";
import type { ListaRevendedores, ResultadoAcao, RevendedorDetalhe } from "@/compartilhado/tipos";
import type { Auth } from "../auth/auth";
import type { Db } from "../db/cliente";
import { empresas, perfis, pontosVenda, vendas } from "../db/esquema";
import { ErroDeNegocio } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";
import { apagarLogin, criarUsuarioComSenhaTemporaria, encerrarSessoesDoUsuario } from "./usuarios";
import { UUID, resumoVendedores, vendasVisiveis } from "./vendas";

/** Busca o revendedor garantindo que ele é da empresa do master e não foi excluído. */
async function revendedorDaEmpresa(db: Db, master: UsuarioDaEmpresa, perfilId: string) {
  if (!UUID.test(perfilId)) return undefined;
  return db
    .select({
      id: perfis.id,
      userId: perfis.userId,
      nome: perfis.nome,
      email: perfis.email,
      telefone: perfis.telefone,
      endereco: perfis.endereco,
      bloqueado: perfis.bloqueado,
      deveTrocarSenha: perfis.deveTrocarSenha,
    })
    .from(perfis)
    .where(
      and(
        eq(perfis.id, perfilId),
        eq(perfis.empresaId, master.empresa.id),
        eq(perfis.papel, "revendedor"),
        isNull(perfis.excluidoEm),
      ),
    )
    .get();
}

export async function listarRevendedores(db: Db, master: UsuarioDaEmpresa): Promise<ListaRevendedores> {
  const [revendedores, empresa, resumo] = await Promise.all([
    db
      .select({
        id: perfis.id,
        nome: perfis.nome,
        email: perfis.email,
        telefone: perfis.telefone,
        bloqueado: perfis.bloqueado,
        deveTrocarSenha: perfis.deveTrocarSenha,
      })
      .from(perfis)
      .where(and(eq(perfis.empresaId, master.empresa.id), eq(perfis.papel, "revendedor"), isNull(perfis.excluidoEm)))
      .orderBy(asc(perfis.nome)),
    db.select({ limite: empresas.limiteRevendedores }).from(empresas).where(eq(empresas.id, master.empresa.id)).get(),
    resumoVendedores(db, master),
  ]);
  return {
    revendedores: revendedores.map((r) => ({ ...r, resumo: resumo.get(r.id) ?? null })),
    limite: empresa?.limite ?? 0,
  };
}

export async function obterRevendedor(db: Db, master: UsuarioDaEmpresa, id: string): Promise<RevendedorDetalhe | null> {
  const revendedor = await revendedorDaEmpresa(db, master, id);
  if (!revendedor) return null;
  const ultimas = await db
    .select({
      id: vendas.id,
      dataVenda: vendas.dataVenda,
      valorTotal: vendas.valorTotalCentavos,
      ponto: { nome: pontosVenda.nome, cidade: pontosVenda.cidade, uf: pontosVenda.uf },
    })
    .from(vendas)
    .innerJoin(pontosVenda, eq(pontosVenda.id, vendas.pontoVendaId))
    .where(and(vendasVisiveis(db, master), eq(vendas.vendedorId, id)))
    .orderBy(desc(vendas.dataVenda))
    .limit(10);
  const { userId: _, ...dados } = revendedor;
  return { revendedor: dados, vendas: ultimas.map((v) => ({ ...v, valorTotal: deCentavos(v.valorTotal) })) };
}

export async function criarRevendedor(
  db: Db,
  auth: Auth,
  master: UsuarioDaEmpresa,
  dados: { nome: string; email: string; telefone: string; endereco: string; senha: string },
): Promise<ResultadoAcao> {
  const resultado = await criarUsuarioComSenhaTemporaria(db, auth, {
    empresaId: master.empresa.id,
    papel: "revendedor",
    nome: dados.nome,
    email: dados.email,
    senhaTemporaria: dados.senha,
    telefone: dados.telefone,
    endereco: dados.endereco,
  });
  if (!resultado.ok) throw new ErroDeNegocio(resultado.erro);
  return {
    sucesso: `${dados.nome} foi cadastrado.`,
    credencial: { email: dados.email.toLowerCase(), senha: dados.senha, endereco: `/${master.empresa.slug}` },
  };
}

/** Bloqueia ou desbloqueia. O bloqueio derruba as sessões abertas e impede novos logins. */
export async function definirBloqueio(db: Db, auth: Auth, master: UsuarioDaEmpresa, perfilId: string, bloquear: boolean) {
  const revendedor = await revendedorDaEmpresa(db, master, perfilId);
  if (!revendedor) throw new ErroDeNegocio("Revendedor não encontrado.");

  await db.update(perfis).set({ bloqueado: bloquear }).where(eq(perfis.id, perfilId));
  if (bloquear && revendedor.userId) await encerrarSessoesDoUsuario(auth, revendedor.userId);

  return bloquear ? `${revendedor.nome} foi bloqueado.` : `${revendedor.nome} foi desbloqueado.`;
}

/**
 * Exclui o revendedor: anonimiza o cadastro e apaga o login. As vendas ficam no histórico.
 * Para não excluir por engano, o master confirma digitando o nome do revendedor.
 */
export async function excluirRevendedor(db: Db, auth: Auth, master: UsuarioDaEmpresa, perfilId: string, confirmacao: string) {
  const revendedor = await revendedorDaEmpresa(db, master, perfilId);
  if (!revendedor) throw new ErroDeNegocio("Revendedor não encontrado.");
  if (paraComparar(confirmacao) !== paraComparar(revendedor.nome)) {
    throw new ErroDeNegocio(`Para confirmar, digite o nome do revendedor: ${revendedor.nome}.`);
  }

  // LGPD: somem os dados pessoais; o histórico de vendas continua com "Revendedor removido".
  await db
    .update(perfis)
    .set({
      nome: "Revendedor removido",
      email: null,
      telefone: null,
      endereco: null,
      bloqueado: true,
      excluidoEm: new Date().toISOString(),
    })
    .where(eq(perfis.id, perfilId));

  if (revendedor.userId) await apagarLogin(auth, revendedor.userId);
  return `${revendedor.nome} foi excluído.`;
}
