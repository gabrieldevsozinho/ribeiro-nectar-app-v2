/**
 * Painel do administrador da plataforma (Gabriel Studio).
 * Por LGPD, o admin vê empresas, limites, masters e o status do Google Maps,
 * mas nenhuma venda, nenhum revendedor e nenhuma chave.
 */
import { and, asc, count, eq, isNull, isNotNull } from "drizzle-orm";
import { slugValido } from "@/compartilhado/slug";
import type { EmpresaDetalhe, EmpresaResumo, ResultadoAcao } from "@/compartilhado/tipos";
import type { Auth } from "../auth/auth";
import type { Db } from "../db/cliente";
import { empresas, googleMapsEmpresa, perfis } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import { contarUsuarios, criarUsuarioComSenhaTemporaria, validarNovoUsuario } from "./usuarios";

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
    throw new ErroDeNegocio("Endereço inválido: use de 3 a 60 letras minúsculas, números e hífens (ex.: apiario-ribeiro).");
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
