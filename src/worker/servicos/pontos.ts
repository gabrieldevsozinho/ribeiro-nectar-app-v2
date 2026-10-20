import { and, asc, count, eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { somenteDigitos } from "@/compartilhado/formato";
import type { DadosPonto, ListaPontos, PontoDetalhe, PontoEscolha, PontoPendente, StatusLocalizacao } from "@/compartilhado/tipos";
import { ufValida } from "@/compartilhado/uf";
import type { Db } from "../db/cliente";
import { pontosVenda } from "../db/esquema";
import { ErroDeNegocio, mensagemErroBanco } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";
import { UUID } from "./vendas";

/** Busca por trecho de texto, sem deixar % e _ do usuário virarem curingas do LIKE. */
function contem(coluna: AnyColumn, termo: string): SQL {
  const padrao = `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`${coluna} like ${padrao} escape '\\'`;
}

const termoSeguro = (texto: string) => texto.trim().slice(0, 60);

const CAMPOS_ESCOLHA = {
  id: pontosVenda.id,
  nome: pontosVenda.nome,
  logradouro: pontosVenda.logradouro,
  numero: pontosVenda.numero,
  bairro: pontosVenda.bairro,
  cidade: pontosVenda.cidade,
  uf: pontosVenda.uf,
};

/** A base de comércios é da empresa: todos veem, para não cadastrar o mesmo comércio duas vezes. */
export async function listarPontos(db: Db, u: UsuarioDaEmpresa, busca: string): Promise<ListaPontos> {
  const termo = termoSeguro(busca);
  const daEmpresa = eq(pontosVenda.empresaId, u.empresa.id);
  const [pontos, pendentes] = await Promise.all([
    db
      .select({ ...CAMPOS_ESCOLHA, localizacaoStatus: pontosVenda.localizacaoStatus })
      .from(pontosVenda)
      .where(
        termo
          ? and(daEmpresa, or(contem(pontosVenda.nome, termo), contem(pontosVenda.cidade, termo), contem(pontosVenda.bairro, termo)))
          : daEmpresa,
      )
      .orderBy(asc(pontosVenda.nome))
      .limit(100),
    db
      .select({ total: count() })
      .from(pontosVenda)
      .where(and(daEmpresa, eq(pontosVenda.localizacaoStatus, "pendente"))),
  ]);
  return { pontos, pendentes: pendentes[0]?.total ?? 0 };
}

/** Busca comércios da empresa para escolher na venda. */
export async function buscarPontos(db: Db, u: UsuarioDaEmpresa, busca: string): Promise<PontoEscolha[]> {
  const termo = termoSeguro(busca);
  if (termo.length < 2) return [];
  return db
    .select(CAMPOS_ESCOLHA)
    .from(pontosVenda)
    .where(
      and(
        eq(pontosVenda.empresaId, u.empresa.id),
        or(
          contem(pontosVenda.nome, termo),
          contem(pontosVenda.cidade, termo),
          contem(pontosVenda.bairro, termo),
          contem(pontosVenda.logradouro, termo),
        ),
      ),
    )
    .orderBy(asc(pontosVenda.nome))
    .limit(12);
}

const CAMPOS_DETALHE = {
  ...CAMPOS_ESCOLHA,
  cnpj: pontosVenda.cnpj,
  contato: pontosVenda.contato,
  telefone: pontosVenda.telefone,
  cep: pontosVenda.cep,
  latitude: pontosVenda.latitude,
  longitude: pontosVenda.longitude,
  localizacaoStatus: pontosVenda.localizacaoStatus,
  criadoPor: pontosVenda.criadoPor,
};

/** Só o master ou quem cadastrou o ponto altera os dados e a localização. */
const podeEditar = (u: UsuarioDaEmpresa, criadoPor: string | null) => u.papel === "master" || criadoPor === u.perfilId;

export async function obterPonto(db: Db, u: UsuarioDaEmpresa, id: string): Promise<PontoDetalhe | null> {
  if (!UUID.test(id)) return null;
  const ponto = await db
    .select(CAMPOS_DETALHE)
    .from(pontosVenda)
    .where(and(eq(pontosVenda.id, id), eq(pontosVenda.empresaId, u.empresa.id)))
    .get();
  if (!ponto) return null;
  const { criadoPor, ...dados } = ponto;
  return { ...dados, podeEditar: podeEditar(u, criadoPor) };
}

type EntradaPonto = Omit<DadosPonto, "cnpj" | "contato" | "telefone" | "numero" | "bairro" | "cep"> & {
  cnpj: string;
  contato: string;
  telefone: string;
  numero: string;
  bairro: string;
  cep: string;
};

/** Confere e normaliza o formulário do ponto (mesmas regras e mensagens do projeto original). */
function lerPonto(entrada: EntradaPonto): DadosPonto {
  const cnpj = somenteDigitos(entrada.cnpj);
  const cep = somenteDigitos(entrada.cep);
  const uf = entrada.uf.toUpperCase();

  if (!entrada.nome) throw new ErroDeNegocio("Informe o nome do comércio.");
  if (cnpj && cnpj.length !== 14) throw new ErroDeNegocio("O CNPJ precisa ter 14 números (ou deixe em branco).");
  if (!entrada.logradouro) throw new ErroDeNegocio("Informe a rua ou avenida.");
  if (!entrada.cidade) throw new ErroDeNegocio("Informe a cidade.");
  if (!ufValida(uf)) throw new ErroDeNegocio("Escolha o estado (UF).");
  if (cep && cep.length !== 8) throw new ErroDeNegocio("O CEP precisa ter 8 números (ou deixe em branco).");

  const { latitude, longitude } = entrada;
  const temCoordenadas =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const status: StatusLocalizacao = temCoordenadas ? (entrada.localizacaoStatus === "ajustada" ? "ajustada" : "automatica") : "pendente";

  return {
    nome: entrada.nome,
    cnpj: cnpj || null,
    contato: entrada.contato || null,
    telefone: entrada.telefone || null,
    logradouro: entrada.logradouro,
    numero: entrada.numero || null,
    bairro: entrada.bairro || null,
    cidade: entrada.cidade,
    uf,
    cep: cep || null,
    latitude: temCoordenadas ? latitude : null,
    longitude: temCoordenadas ? longitude : null,
    localizacaoStatus: status,
  };
}

export async function criarPonto(db: Db, u: UsuarioDaEmpresa, entrada: EntradaPonto): Promise<string> {
  const dados = lerPonto(entrada);
  try {
    const criado = await db
      .insert(pontosVenda)
      .values({ ...dados, empresaId: u.empresa.id, criadoPor: u.perfilId })
      .returning({ id: pontosVenda.id })
      .get();
    return criado.id;
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
}

async function exigirPermissaoDeEdicao(db: Db, u: UsuarioDaEmpresa, pontoId: string) {
  if (!UUID.test(pontoId)) throw new ErroDeNegocio("Ponto de venda não encontrado.");
  const ponto = await db
    .select({ criadoPor: pontosVenda.criadoPor })
    .from(pontosVenda)
    .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id)))
    .get();
  if (!ponto) throw new ErroDeNegocio("Ponto de venda não encontrado.");
  if (!podeEditar(u, ponto.criadoPor)) throw new ErroDeNegocio("Só o master ou quem cadastrou o ponto pode alterá-lo.");
}

export async function alterarPonto(db: Db, u: UsuarioDaEmpresa, pontoId: string, entrada: EntradaPonto) {
  const dados = lerPonto(entrada);
  await exigirPermissaoDeEdicao(db, u, pontoId);
  try {
    await db
      .update(pontosVenda)
      .set(dados)
      .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id)));
  } catch (erro) {
    throw new ErroDeNegocio(mensagemErroBanco(erro));
  }
}

/** Grava a localização encontrada no mapa (pendentes localizados ou pino ajustado). */
export async function definirLocalizacao(
  db: Db,
  u: UsuarioDaEmpresa,
  pontoId: string,
  local: { latitude: number; longitude: number; status: "automatica" | "ajustada" },
) {
  await exigirPermissaoDeEdicao(db, u, pontoId);
  await db
    .update(pontosVenda)
    .set({ latitude: local.latitude, longitude: local.longitude, localizacaoStatus: local.status })
    .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id)));
}

/** Pontos sem localização, para o master localizar quando houver mapa. */
export async function pontosPendentes(db: Db, u: UsuarioDaEmpresa): Promise<PontoPendente[]> {
  return db
    .select({ ...CAMPOS_ESCOLHA, cep: pontosVenda.cep })
    .from(pontosVenda)
    .where(and(eq(pontosVenda.empresaId, u.empresa.id), eq(pontosVenda.localizacaoStatus, "pendente")))
    .limit(50);
}

export async function contarPendentes(db: Db, u: UsuarioDaEmpresa): Promise<number> {
  const linha = await db
    .select({ total: count() })
    .from(pontosVenda)
    .where(and(eq(pontosVenda.empresaId, u.empresa.id), eq(pontosVenda.localizacaoStatus, "pendente")))
    .get();
  return linha?.total ?? 0;
}
