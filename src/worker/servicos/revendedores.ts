import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { deCentavos } from "@/compartilhado/formato";
import type { ListaRevendedores, ResultadoAcao, RevendedorDetalhe } from "@/compartilhado/tipos";
import type { Auth } from "../auth/auth";
import type { Db } from "../db/cliente";
import { codigosExclusao, empresas, perfis, pontosVenda, vendas } from "../db/esquema";
import { ErroDeNegocio } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";
import { enviarEmail, escaparHtml } from "./email";
import { apagarLogin, criarUsuarioComSenhaTemporaria, encerrarSessoesDoUsuario } from "./usuarios";
import { UUID, resumoVendedores, vendasVisiveis } from "./vendas";

const MINUTOS_VALIDADE = 15;
const MAX_TENTATIVAS = 5;

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

/** Hash do código de exclusão: amarrado ao revendedor e ao segredo do servidor. */
async function hashDoCodigo(segredo: string, codigo: string, revendedorId: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${codigo}:${revendedorId}:${segredo}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara sem atalhos, para o tempo de resposta não revelar o código. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Número de 6 dígitos sem viés (descarta os sorteios que passariam do último milhão inteiro). */
function sortearCodigo(): string {
  const limite = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  let valor: number;
  do valor = crypto.getRandomValues(new Uint32Array(1))[0];
  while (valor >= limite);
  return String(valor % 1_000_000).padStart(6, "0");
}

/** Passo 1 da exclusão: gera um código e envia para o e-mail do master que pediu. */
export async function solicitarCodigoExclusao(env: Env, db: Db, master: UsuarioDaEmpresa, perfilId: string): Promise<ResultadoAcao> {
  const revendedor = await revendedorDaEmpresa(db, master, perfilId);
  if (!revendedor) throw new ErroDeNegocio("Revendedor não encontrado.");
  if (!master.email) throw new ErroDeNegocio("Seu cadastro não tem e-mail para receber o código.");

  const agora = new Date();
  const codigo = sortearCodigo();
  // Um pedido novo invalida os códigos anteriores deste revendedor.
  await db.batch([
    db
      .update(codigosExclusao)
      .set({ expiraEm: agora.toISOString() })
      .where(and(eq(codigosExclusao.revendedorId, perfilId), isNull(codigosExclusao.usadoEm))),
    db.insert(codigosExclusao).values({
      empresaId: master.empresa.id,
      revendedorId: perfilId,
      masterId: master.perfilId,
      codigoHash: await hashDoCodigo(env.BETTER_AUTH_SECRET, codigo, perfilId),
      expiraEm: new Date(agora.getTime() + MINUTOS_VALIDADE * 60_000).toISOString(),
    }),
  ]);

  const nome = escaparHtml(revendedor.nome);
  const envio = await enviarEmail(env, {
    para: master.email,
    assunto: `Código para excluir ${revendedor.nome} · Ribeiro Néctar`,
    texto: `Você pediu para excluir o revendedor ${revendedor.nome}.\n\nCódigo: ${codigo}\n\nEle vale por ${MINUTOS_VALIDADE} minutos. Se não foi você, ignore este e-mail.`,
    html: `<p>Você pediu para excluir o revendedor <strong>${nome}</strong>.</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${codigo}</p><p>O código vale por ${MINUTOS_VALIDADE} minutos. Se não foi você, ignore este e-mail.</p>`,
  });
  if (!envio.ok) throw new ErroDeNegocio("Não foi possível enviar o e-mail com o código. Tente de novo mais tarde.");

  return { codigoEnviado: true, sucesso: `Enviamos um código para ${master.email}.` };
}

/** Resposta de código errado: diz se ainda dá para tentar (a tela continua pedindo o código). */
export class CodigoRecusado extends ErroDeNegocio {
  constructor(
    mensagem: string,
    readonly podeTentarDeNovo: boolean,
  ) {
    super(mensagem);
  }
}

/** Passo 2: confere o código, anonimiza o cadastro e apaga o login. As vendas ficam. */
export async function confirmarExclusao(env: Env, db: Db, auth: Auth, master: UsuarioDaEmpresa, perfilId: string, codigoDigitado: string) {
  const revendedor = await revendedorDaEmpresa(db, master, perfilId);
  if (!revendedor) throw new ErroDeNegocio("Revendedor não encontrado.");

  const codigo = codigoDigitado.replace(/\D/g, "");
  const pedido = await db
    .select({ id: codigosExclusao.id, codigoHash: codigosExclusao.codigoHash, tentativas: codigosExclusao.tentativas })
    .from(codigosExclusao)
    .where(
      and(
        eq(codigosExclusao.revendedorId, perfilId),
        eq(codigosExclusao.masterId, master.perfilId),
        isNull(codigosExclusao.usadoEm),
        gt(codigosExclusao.expiraEm, new Date().toISOString()),
      ),
    )
    .orderBy(desc(codigosExclusao.criadoEm))
    .limit(1)
    .get();

  if (!pedido || pedido.tentativas >= MAX_TENTATIVAS) {
    throw new CodigoRecusado("Código expirado ou inválido. Peça um código novo.", false);
  }

  const recebido = await hashDoCodigo(env.BETTER_AUTH_SECRET, codigo, perfilId);
  if (codigo.length !== 6 || !iguais(pedido.codigoHash, recebido)) {
    await db
      .update(codigosExclusao)
      .set({ tentativas: pedido.tentativas + 1 })
      .where(eq(codigosExclusao.id, pedido.id));
    const restantes = MAX_TENTATIVAS - pedido.tentativas - 1;
    throw new CodigoRecusado(
      restantes > 0 ? `Código incorreto. Restam ${restantes} tentativas.` : "Código incorreto. Peça um código novo.",
      restantes > 0,
    );
  }

  // LGPD: somem os dados pessoais; o histórico de vendas continua com "Revendedor removido".
  const agora = new Date().toISOString();
  await db.batch([
    db.update(codigosExclusao).set({ usadoEm: agora }).where(eq(codigosExclusao.id, pedido.id)),
    db
      .update(perfis)
      .set({ nome: "Revendedor removido", email: null, telefone: null, endereco: null, bloqueado: true, excluidoEm: agora })
      .where(eq(perfis.id, perfilId)),
  ]);

  if (revendedor.userId) await apagarLogin(auth, revendedor.userId);
}
