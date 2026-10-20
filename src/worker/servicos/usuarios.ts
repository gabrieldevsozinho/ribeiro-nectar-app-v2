import { and, count, eq, isNull, sql } from "drizzle-orm";
import { validarSenha } from "@/compartilhado/senha";
import type { Papel } from "@/compartilhado/tipos";
import type { Auth } from "../auth/auth";
import type { Db } from "../db/cliente";
import { authUsuarios, empresas, perfis } from "../db/esquema";
import { mensagemErroBanco } from "../erros";

export type NovoUsuario = {
  empresaId: string;
  papel: Exclude<Papel, "admin_plataforma">;
  nome: string;
  email: string;
  senhaTemporaria: string;
  telefone?: string | null;
  endereco?: string | null;
};

export type ResultadoCriacao = { ok: true; perfilId: string } | { ok: false; erro: string };

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Confere os dados antes de criar o login. Devolve a primeira mensagem de erro. */
export function validarNovoUsuario(dados: { nome: string; email: string; senhaTemporaria: string }): string | null {
  if (dados.nome.trim().length < 2) return "Informe o nome.";
  if (!EMAIL_VALIDO.test(dados.email)) return "Informe um e-mail válido.";
  return validarSenha(dados.senhaTemporaria);
}

/** Cria o login (Better Auth) já com a senha, sem passar pelo cadastro público (que é desligado). */
export async function criarLogin(auth: Auth, dados: { nome: string; email: string; senha: string }) {
  const contexto = await auth.$context;
  const usuario = await contexto.internalAdapter.createUser(
    { name: dados.nome, email: dados.email, emailVerified: true },
    { method: "admin" },
  );
  await contexto.internalAdapter.linkAccount({
    userId: usuario.id,
    providerId: "credential",
    accountId: usuario.id,
    password: await contexto.password.hash(dados.senha),
  });
  return usuario.id;
}

/** Apaga o login (e, em cascata, as sessões). O perfil fica, sem vínculo, para o histórico. */
export async function apagarLogin(auth: Auth, userId: string) {
  const contexto = await auth.$context;
  await contexto.internalAdapter.deleteUser(userId);
}

/** Derruba todas as sessões abertas de um usuário (ex.: ao bloquear). */
export async function encerrarSessoesDoUsuario(auth: Auth, userId: string) {
  const contexto = await auth.$context;
  await contexto.internalAdapter.deleteUserSessions(userId);
}

/** Quantos usuários ativos (não excluídos) a empresa tem de cada papel. */
export async function contarUsuarios(db: Db, empresaId: string) {
  const linhas = await db
    .select({ papel: perfis.papel, total: count() })
    .from(perfis)
    .where(and(eq(perfis.empresaId, empresaId), isNull(perfis.excluidoEm)))
    .groupBy(perfis.papel);
  return {
    masters: linhas.find((l) => l.papel === "master")?.total ?? 0,
    revendedores: linhas.find((l) => l.papel === "revendedor")?.total ?? 0,
  };
}

/**
 * Cria o login e o perfil com senha temporária.
 * Só chame depois de conferir que quem pede tem permissão.
 * Se o perfil for recusado (ex.: limite do plano), o login criado é desfeito.
 */
export async function criarUsuarioComSenhaTemporaria(db: Db, auth: Auth, dados: NovoUsuario): Promise<ResultadoCriacao> {
  const email = dados.email.trim().toLowerCase();
  const problema = validarNovoUsuario({ ...dados, email });
  if (problema) return { ok: false, erro: problema };

  // Confere o limite antes de criar o login, para dar a mensagem certa (o banco confere de novo).
  const empresa = await db
    .select({ limiteMasters: empresas.limiteMasters, limiteRevendedores: empresas.limiteRevendedores })
    .from(empresas)
    .where(eq(empresas.id, dados.empresaId))
    .get();
  if (!empresa) return { ok: false, erro: "Empresa não encontrada." };
  const emUso = await contarUsuarios(db, dados.empresaId);
  const limite = dados.papel === "master" ? empresa.limiteMasters : empresa.limiteRevendedores;
  if ((dados.papel === "master" ? emUso.masters : emUso.revendedores) >= limite) {
    return { ok: false, erro: mensagemErroBanco("LIMITE_PLANO") };
  }

  const jaExiste = await db
    .select({ id: authUsuarios.id })
    .from(authUsuarios)
    .where(sql`lower(${authUsuarios.email}) = ${email}`)
    .get();
  if (jaExiste) return { ok: false, erro: "Já existe um usuário com este e-mail." };

  let userId: string;
  try {
    userId = await criarLogin(auth, { nome: dados.nome.trim(), email, senha: dados.senhaTemporaria });
  } catch (erro) {
    return { ok: false, erro: mensagemErroBanco(erro) };
  }

  try {
    const perfil = await db
      .insert(perfis)
      .values({
        userId,
        empresaId: dados.empresaId,
        papel: dados.papel,
        nome: dados.nome.trim(),
        email,
        telefone: dados.telefone?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        deveTrocarSenha: true,
      })
      .returning({ id: perfis.id })
      .get();
    return { ok: true, perfilId: perfil.id };
  } catch (erro) {
    await apagarLogin(auth, userId);
    return { ok: false, erro: mensagemErroBanco(erro) };
  }
}
