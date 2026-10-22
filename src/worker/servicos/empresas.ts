/**
 * Painel do administrador da plataforma (Gabriel Studio).
 * Por LGPD, o admin vê empresas, limites, masters e o status do Google Maps,
 * mas nenhuma venda, nenhum revendedor e nenhuma chave.
 */
import { and, asc, count, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { DEFAULT_CATEGORIAS_PRODUTO } from "@/compartilhado/produtos";
import { validarSenha } from "@/compartilhado/senha";
import { slugValido } from "@/compartilhado/slug";
import type { EmpresaDetalhe, EmpresaResumo, ResultadoAcao } from "@/compartilhado/tipos";
import type { Auth } from "../auth/auth";
import type { Db } from "../db/cliente";
import { authUsuarios, empresas, googleMapsEmpresa, perfis } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import { criarCategoriasIniciais } from "./categorias-produto";
import {
  EMAIL_VALIDO,
  apagarLogin,
  contarUsuarios,
  criarUsuarioComSenhaTemporaria,
  encerrarSessoesDoUsuario,
  validarNovoUsuario,
} from "./usuarios";

const CAMPOS_MAPS = { status: googleMapsEmpresa.status, validadaEm: googleMapsEmpresa.validadaEm, ultimoErro: googleMapsEmpresa.ultimoErro };

function inteiro(texto: string): number | null {
  const valor = Number(texto);
  return texto !== "" && Number.isInteger(valor) ? valor : null;
}

function lerLimites(dados: { limiteMasters: string; limiteRevendedores: string }) {
  const limiteMasters = inteiro(dados.limiteMasters);
  const limiteRevendedores = inteiro(dados.limiteRevendedores);
  if (limiteMasters === null || limiteMasters < 1) throw new ErroDeNegocio("O limite de masters precisa ser pelo menos 1.");
  if (limiteRevendedores === null || limiteRevendedores < 0) throw new ErroDeNegocio("Informe o limite de revendedores.");
  return { limiteMasters, limiteRevendedores };
}

export async function listarEmpresas(db: Db): Promise<EmpresaResumo[]> {
  const [linhas, contagens] = await Promise.all([
    db
      .select({
        id: empresas.id,
        nome: empresas.nome,
        slug: empresas.slug,
        ativa: empresas.ativa,
        limiteMasters: empresas.limiteMasters,
        limiteRevendedores: empresas.limiteRevendedores,
        criadoEm: empresas.criadoEm,
        maps: CAMPOS_MAPS,
      })
      .from(empresas)
      .leftJoin(googleMapsEmpresa, eq(googleMapsEmpresa.empresaId, empresas.id))
      .orderBy(asc(empresas.nome)),
    // Só a contagem por papel: o admin não lê os dados dos revendedores.
    db
      .select({ empresaId: perfis.empresaId, papel: perfis.papel, total: count() })
      .from(perfis)
      .where(and(isNull(perfis.excluidoEm), isNotNull(perfis.empresaId)))
      .groupBy(perfis.empresaId, perfis.papel),
  ]);
  const contar = (empresaId: string, papel: "master" | "revendedor") =>
    contagens.find((c) => c.empresaId === empresaId && c.papel === papel)?.total ?? 0;
  return linhas.map((e) => ({
    ...e,
    maps: e.maps ?? { status: "nao_configurada", validadaEm: null, ultimoErro: null },
    masters: contar(e.id, "master"),
    revendedores: contar(e.id, "revendedor"),
  }));
}

export async function obterEmpresa(db: Db, id: string): Promise<EmpresaDetalhe | null> {
  const empresa = await db
    .select({
      id: empresas.id,
      nome: empresas.nome,
      slug: empresas.slug,
      ativa: empresas.ativa,
      limiteMasters: empresas.limiteMasters,
      limiteRevendedores: empresas.limiteRevendedores,
      maps: CAMPOS_MAPS,
    })
    .from(empresas)
    .leftJoin(googleMapsEmpresa, eq(googleMapsEmpresa.empresaId, empresas.id))
    .where(eq(empresas.id, id))
    .get();
  if (!empresa) return null;

  const [masters, emUso] = await Promise.all([
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
      .where(and(eq(perfis.empresaId, id), eq(perfis.papel, "master"), isNull(perfis.excluidoEm)))
      .orderBy(asc(perfis.criadoEm)),
    contarUsuarios(db, id),
  ]);
  return { ...empresa, maps: empresa.maps ?? { status: "nao_configurada", validadaEm: null, ultimoErro: null }, masters, emUso };
}

/** Cadastra a empresa e o primeiro master dela. */
export async function criarEmpresa(
  db: Db,
  auth: Auth,
  dados: {
    nome: string;
    slug: string;
    limiteMasters: string;
    limiteRevendedores: string;
    master: { nome: string; email: string; telefone: string; senha: string };
  },
): Promise<ResultadoAcao> {
  if (dados.nome.length < 2) throw new ErroDeNegocio("Informe o nome da empresa.");
  if (!slugValido(dados.slug)) {
    throw new ErroDeNegocio("Endereço inválido: use de 3 a 60 letras minúsculas, números e hífens (ex.: apiario-exemplo).");
  }
  const limites = lerLimites(dados);
  const problemaMaster = validarNovoUsuario({ ...dados.master, senhaTemporaria: dados.master.senha });
  if (problemaMaster) throw new ErroDeNegocio(`Master inicial: ${problemaMaster}`);

  let empresaId: string;
  try {
    const criada = await db
      .insert(empresas)
      .values({ nome: dados.nome, slug: dados.slug, ...limites })
      .returning({ id: empresas.id })
      .get();
    empresaId = criada.id;
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
  // Conjunto inicial de categorias do catálogo; o master cria ou exclui as da própria empresa dali em diante.
  await criarCategoriasIniciais(db, empresaId, DEFAULT_CATEGORIAS_PRODUTO);

  const resultado = await criarUsuarioComSenhaTemporaria(db, auth, {
    empresaId,
    papel: "master",
    nome: dados.master.nome,
    email: dados.master.email,
    senhaTemporaria: dados.master.senha,
    telefone: dados.master.telefone,
  });
  if (!resultado.ok) {
    // Sem o master a empresa ficaria inacessível: desfaz o cadastro (a configuração do Maps vai junto).
    await db.delete(empresas).where(eq(empresas.id, empresaId));
    throw new ErroDeNegocio(`Master inicial: ${resultado.erro}`);
  }

  return {
    sucesso: `Empresa "${dados.nome}" cadastrada.`,
    credencial: { email: dados.master.email, senha: dados.master.senha, endereco: `/${dados.slug}` },
  };
}

/** Altera nome e limites do plano. Não deixa o limite ficar abaixo do que já está em uso. */
export async function alterarEmpresa(
  db: Db,
  id: string,
  dados: { nome: string; limiteMasters: string; limiteRevendedores: string },
) {
  if (dados.nome.length < 2) throw new ErroDeNegocio("Informe o nome da empresa.");
  const limites = lerLimites(dados);

  const emUso = await contarUsuarios(db, id);
  if (limites.limiteMasters < emUso.masters) {
    throw new ErroDeNegocio(`A empresa já tem ${emUso.masters} masters. O limite não pode ser menor que isso.`);
  }
  if (limites.limiteRevendedores < emUso.revendedores) {
    throw new ErroDeNegocio(`A empresa já tem ${emUso.revendedores} revendedores. O limite não pode ser menor que isso.`);
  }

  const alteradas = await db
    .update(empresas)
    .set({ nome: dados.nome, ...limites })
    .where(eq(empresas.id, id))
    .returning({ id: empresas.id });
  if (alteradas.length === 0) throw new ErroDeNegocio("Empresa não encontrada.");
  return "Alterações salvas.";
}

/** Ativa ou desativa a empresa. Desativada, ninguém dela entra; os dados ficam guardados. */
export async function definirEmpresaAtiva(db: Db, id: string, ativa: boolean) {
  const alteradas = await db.update(empresas).set({ ativa }).where(eq(empresas.id, id)).returning({ id: empresas.id });
  if (alteradas.length === 0) throw new ErroDeNegocio("Empresa não encontrada.");
  return ativa ? "Empresa reativada." : "Empresa desativada.";
}

/** Cadastra mais um master na empresa (dentro do limite do plano). */
export async function adicionarMaster(
  db: Db,
  auth: Auth,
  empresaId: string,
  dados: { nome: string; email: string; telefone: string; senha: string },
): Promise<ResultadoAcao> {
  const resultado = await criarUsuarioComSenhaTemporaria(db, auth, {
    empresaId,
    papel: "master",
    nome: dados.nome,
    email: dados.email,
    senhaTemporaria: dados.senha,
    telefone: dados.telefone,
  });
  if (!resultado.ok) throw new ErroDeNegocio(resultado.erro);
  return { sucesso: `Master ${dados.nome} cadastrado.`, credencial: { email: dados.email, senha: dados.senha } };
}

/** Busca o master garantindo que ele é da empresa e não foi excluído. */
async function masterDaEmpresa(db: Db, empresaId: string, perfilId: string) {
  return db
    .select({ id: perfis.id, userId: perfis.userId, nome: perfis.nome, email: perfis.email })
    .from(perfis)
    .where(and(eq(perfis.id, perfilId), eq(perfis.empresaId, empresaId), eq(perfis.papel, "master"), isNull(perfis.excluidoEm)))
    .get();
}

/**
 * Altera nome, e-mail e telefone de um master e, se o admin informar, define uma nova senha temporária.
 *
 * As vendas, os pontos e tudo que o master cadastrou apontam para o cadastro dele (perfis.id), não para o
 * e-mail nem para a senha: trocar esses dados não afasta nada do histórico. O e-mail é atualizado nos dois
 * lugares em que existe (o perfil e o login), na mesma gravação.
 * Trocar o e-mail ou a senha derruba as sessões abertas dele; a nova senha é temporária (ele troca no próximo acesso).
 */
export async function alterarMaster(
  db: Db,
  auth: Auth,
  empresaId: string,
  perfilId: string,
  dados: { nome: string; email: string; telefone: string; senha: string },
): Promise<ResultadoAcao> {
  const master = await masterDaEmpresa(db, empresaId, perfilId);
  if (!master) throw new ErroDeNegocio("Master não encontrado.");

  const email = dados.email.trim().toLowerCase();
  if (dados.nome.length < 2) throw new ErroDeNegocio("Informe o nome.");
  if (!EMAIL_VALIDO.test(email)) throw new ErroDeNegocio("Informe um e-mail válido.");
  if (dados.senha) {
    const problema = validarSenha(dados.senha);
    if (problema) throw new ErroDeNegocio(problema);
  }

  const trocouEmail = email !== (master.email ?? "").toLowerCase();
  if (trocouEmail) {
    const emUso = await db
      .select({ id: authUsuarios.id })
      .from(authUsuarios)
      .where(sql`lower(${authUsuarios.email}) = ${email}`)
      .get();
    if (emUso && emUso.id !== master.userId) throw new ErroDeNegocio("Já existe um usuário com este e-mail.");
  }

  try {
    const perfilAtualizado = db
      .update(perfis)
      .set({ nome: dados.nome, email, telefone: dados.telefone || null, ...(dados.senha ? { deveTrocarSenha: true } : {}) })
      .where(eq(perfis.id, perfilId));
    if (master.userId) {
      // Perfil e login são gravados juntos: ou muda o e-mail dos dois, ou de nenhum.
      await db.batch([
        perfilAtualizado,
        db.update(authUsuarios).set({ name: dados.nome, email, updatedAt: new Date() }).where(eq(authUsuarios.id, master.userId)),
      ]);
    } else {
      await perfilAtualizado;
    }
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }

  if (master.userId && (trocouEmail || dados.senha)) {
    if (dados.senha) {
      const contexto = await auth.$context;
      await contexto.internalAdapter.updatePassword(master.userId, await contexto.password.hash(dados.senha));
    }
    await encerrarSessoesDoUsuario(auth, master.userId);
  }

  return dados.senha
    ? { sucesso: `Dados de ${dados.nome} salvos e nova senha temporária definida.`, credencial: { email, senha: dados.senha } }
    : { sucesso: `Dados de ${dados.nome} salvos.` };
}

/**
 * Exclui um master: o login é apagado e os dados pessoais são removidos, mas o cadastro fica como
 * "Master removido" para as vendas e os pontos dele continuarem no histórico. Como as vendas de um master
 * só aparecem para os outros se ele compartilha, a exclusão liga o compartilhamento: senão elas sumiriam.
 * A empresa nunca fica sem master.
 */
export async function excluirMaster(db: Db, auth: Auth, empresaId: string, perfilId: string) {
  const master = await masterDaEmpresa(db, empresaId, perfilId);
  if (!master) throw new ErroDeNegocio("Master não encontrado.");

  const emUso = await contarUsuarios(db, empresaId);
  if (emUso.masters <= 1) {
    throw new ErroDeNegocio("A empresa precisa ter pelo menos 1 master. Cadastre outro antes de excluir este.");
  }

  await db
    .update(perfis)
    .set({
      nome: "Master removido",
      email: null,
      telefone: null,
      endereco: null,
      bloqueado: true,
      compartilhaVendas: true,
      excluidoEm: new Date().toISOString(),
    })
    .where(eq(perfis.id, perfilId));
  if (master.userId) await apagarLogin(auth, master.userId);

  return `${master.nome} foi excluído. As vendas dele continuam no histórico, como “Master removido”.`;
}
