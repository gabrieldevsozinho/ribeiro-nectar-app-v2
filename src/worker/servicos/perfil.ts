import { eq } from "drizzle-orm";
import { validarSenha } from "@/compartilhado/senha";
import type { Perfil } from "@/compartilhado/tipos";
import type { Auth } from "../auth/auth";
import type { Db } from "../db/cliente";
import { perfis } from "../db/esquema";
import { ErroDeNegocio } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

export async function obterPerfil(db: Db, u: UsuarioDaEmpresa): Promise<Perfil | undefined> {
  return db
    .select({
      nome: perfis.nome,
      email: perfis.email,
      telefone: perfis.telefone,
      endereco: perfis.endereco,
      compartilhaVendas: perfis.compartilhaVendas,
    })
    .from(perfis)
    .where(eq(perfis.id, u.perfilId))
    .get();
}

/** O próprio usuário só muda nome, telefone, endereço e (o master) a opção de compartilhar. */
export async function salvarPerfil(
  db: Db,
  u: UsuarioDaEmpresa,
  dados: { nome: string; telefone: string; endereco: string; compartilhaVendas?: boolean },
) {
  if (dados.nome.length < 2) throw new ErroDeNegocio("Informe o seu nome.");
  await db
    .update(perfis)
    .set({
      nome: dados.nome,
      telefone: dados.telefone || null,
      endereco: dados.endereco || null,
      ...(u.papel === "master" ? { compartilhaVendas: Boolean(dados.compartilhaVendas) } : {}),
    })
    .where(eq(perfis.id, u.perfilId));
  return "Dados salvos.";
}

/** Troca de senha pela tela de perfil: confere a senha atual (Better Auth). */
export async function trocarSenha(auth: Auth, cabecalhos: Headers, dados: { senhaAtual: string; senhaNova: string; confirmacao: string }) {
  const problema = validarSenha(dados.senhaNova);
  if (problema) throw new ErroDeNegocio(problema);
  if (dados.senhaNova !== dados.confirmacao) throw new ErroDeNegocio("As duas senhas novas não são iguais.");
  if (dados.senhaNova === dados.senhaAtual) throw new ErroDeNegocio("A nova senha precisa ser diferente da atual.");

  try {
    await auth.api.changePassword({
      headers: cabecalhos,
      body: { currentPassword: dados.senhaAtual, newPassword: dados.senhaNova, revokeOtherSessions: false },
    });
  } catch {
    throw new ErroDeNegocio("A senha atual está incorreta.");
  }
  return "Senha alterada.";
}

/** Troca obrigatória da senha temporária no primeiro acesso. */
export async function trocarSenhaInicial(db: Db, auth: Auth, u: UsuarioDaEmpresa & { userId: string }, dados: { senha: string; confirmacao: string }) {
  const problema = validarSenha(dados.senha);
  if (problema) throw new ErroDeNegocio(problema);
  if (dados.senha !== dados.confirmacao) throw new ErroDeNegocio("As duas senhas não são iguais.");

  const contexto = await auth.$context;
  const conta = await contexto.internalAdapter.findCredentialAccount(u.userId);
  if (conta?.password && (await contexto.password.verify({ hash: conta.password, password: dados.senha }))) {
    throw new ErroDeNegocio("A nova senha precisa ser diferente da senha temporária.");
  }

  await contexto.internalAdapter.updatePassword(u.userId, await contexto.password.hash(dados.senha));
  // O próprio usuário não altera esta coluna pela tela de perfil: só por aqui, depois de trocar a senha.
  await db.update(perfis).set({ deveTrocarSenha: false }).where(eq(perfis.id, u.perfilId));
}
