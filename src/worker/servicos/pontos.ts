import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { chaveCidade, limparCidade, melhorGrafia } from "@/compartilhado/cidades";
import { somenteDigitos } from "@/compartilhado/formato";
import type {
  CidadeCadastrada,
  DadosMapa,
  DadosPonto,
  ListaPontos,
  PontoDetalhe,
  PontoEscolha,
  PontoPendente,
  StatusLocalizacao,
} from "@/compartilhado/tipos";
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
  const cidade = limparCidade(entrada.cidade);

  if (!entrada.nome) throw new ErroDeNegocio("Informe o nome do comércio.");
  if (cnpj && cnpj.length !== 14) throw new ErroDeNegocio("O CNPJ precisa ter 14 números (ou deixe em branco).");
  if (!entrada.logradouro) throw new ErroDeNegocio("Informe a rua ou avenida.");
  if (!cidade) throw new ErroDeNegocio("Informe a cidade.");
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
    cidade,
    uf,
    cep: cep || null,
    latitude: temCoordenadas ? latitude : null,
    longitude: temCoordenadas ? longitude : null,
    localizacaoStatus: status,
  };
}

/**
 * A cidade é digitada à mão: se a empresa já tem a mesma cidade escrita de outro jeito
 * ("Santa Vitoria" × "Santa Vitória"), o ponto fica com a grafia mais completa e, se a
 * digitada for a mais completa, os outros pontos da cidade passam a usá-la também.
 */
async function unificarCidade(db: Db, u: UsuarioDaEmpresa, dados: DadosPonto, pontoId?: string) {
  const chave = chaveCidade(dados.cidade, dados.uf);
  const existentes = (
    await db
      .select({ cidade: pontosVenda.cidade, usos: count() })
      .from(pontosVenda)
      .where(
        and(eq(pontosVenda.empresaId, u.empresa.id), eq(pontosVenda.uf, dados.uf), pontoId ? ne(pontosVenda.id, pontoId) : undefined),
      )
      .groupBy(pontosVenda.cidade)
      .orderBy(desc(count()))
  ).filter((g) => chaveCidade(g.cidade, dados.uf) === chave);

  const cidade = existentes.length ? melhorGrafia([...existentes, { cidade: dados.cidade, usos: 1 }]) : dados.cidade;
  const outrasGrafias = existentes.map((g) => g.cidade).filter((c) => c !== cidade);
  const corrigirOutros = outrasGrafias.length
    ? [
        db
          .update(pontosVenda)
          .set({ cidade })
          .where(and(eq(pontosVenda.empresaId, u.empresa.id), eq(pontosVenda.uf, dados.uf), inArray(pontosVenda.cidade, outrasGrafias))),
      ]
    : [];
  return { cidade, corrigirOutros };
}

export async function criarPonto(db: Db, u: UsuarioDaEmpresa, entrada: EntradaPonto): Promise<string> {
  const dados = lerPonto(entrada);
  const { cidade, corrigirOutros } = await unificarCidade(db, u, dados);
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(pontosVenda).values({ ...dados, cidade, id, empresaId: u.empresa.id, criadoPor: u.perfilId }),
      ...corrigirOutros,
    ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    return id;
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
  const { cidade, corrigirOutros } = await unificarCidade(db, u, dados, pontoId);
  try {
    await db.batch([
      // Endereço novo: a busca automática pode tentar de novo.
      db
        .update(pontosVenda)
        .set({ ...dados, cidade, localizacaoFalhouEm: null })
        .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id))),
      ...corrigirOutros,
    ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
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
    .set({ latitude: local.latitude, longitude: local.longitude, localizacaoStatus: local.status, localizacaoFalhouEm: null })
    .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id)));
}

/** A busca automática não achou o endereço: não tenta de novo sozinha (o master ajusta o pino). */
export async function marcarNaoEncontrado(db: Db, u: UsuarioDaEmpresa, pontoId: string) {
  await exigirPermissaoDeEdicao(db, u, pontoId);
  await db
    .update(pontosVenda)
    .set({ localizacaoFalhouEm: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(and(eq(pontosVenda.id, pontoId), eq(pontosVenda.empresaId, u.empresa.id), eq(pontosVenda.localizacaoStatus, "pendente")));
}

const pendentesDaEmpresa = (u: UsuarioDaEmpresa) =>
  and(eq(pontosVenda.empresaId, u.empresa.id), eq(pontosVenda.localizacaoStatus, "pendente"));

/**
 * Pontos sem localização, para o master localizar quando houver mapa. Sem `incluirNaoEncontrados`,
 * só os que a busca automática ainda não tentou.
 */
export async function pontosPendentes(db: Db, u: UsuarioDaEmpresa, incluirNaoEncontrados = false): Promise<PontoPendente[]> {
  return db
    .select({ ...CAMPOS_ESCOLHA, cep: pontosVenda.cep })
    .from(pontosVenda)
    .where(incluirNaoEncontrados ? pendentesDaEmpresa(u) : and(pendentesDaEmpresa(u), isNull(pontosVenda.localizacaoFalhouEm)))
    .orderBy(asc(pontosVenda.nome))
    .limit(50);
}

/** Resumo para o mapa: quantos ainda dá para procurar e quais não foram achados. */
export async function resumoPendentes(db: Db, u: UsuarioDaEmpresa): Promise<DadosMapa["pendentes"]> {
  const [aLocalizar, naoEncontrados] = await Promise.all([
    db
      .select({ total: count() })
      .from(pontosVenda)
      .where(and(pendentesDaEmpresa(u), isNull(pontosVenda.localizacaoFalhouEm)))
      .get(),
    db
      .select({ ...CAMPOS_ESCOLHA, cep: pontosVenda.cep })
      .from(pontosVenda)
      .where(and(pendentesDaEmpresa(u), isNotNull(pontosVenda.localizacaoFalhouEm)))
      .orderBy(asc(pontosVenda.nome))
      .limit(50),
  ]);
  return { aLocalizar: aLocalizar?.total ?? 0, naoEncontrados };
}

/** Cidades dos pontos da empresa (uma grafia por cidade), para sugerir no cadastro. */
export async function cidadesCadastradas(db: Db, u: UsuarioDaEmpresa): Promise<CidadeCadastrada[]> {
  const linhas = await db
    .select({ cidade: pontosVenda.cidade, uf: pontosVenda.uf, usos: count() })
    .from(pontosVenda)
    .where(eq(pontosVenda.empresaId, u.empresa.id))
    .groupBy(pontosVenda.cidade, pontosVenda.uf);

  const grupos = new Map<string, { uf: string; grafias: { cidade: string; usos: number }[] }>();
  for (const l of linhas) {
    const chave = chaveCidade(l.cidade, l.uf);
    const grupo = grupos.get(chave) ?? { uf: l.uf, grafias: [] };
    grupo.grafias.push({ cidade: l.cidade, usos: l.usos });
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map((g) => ({ cidade: melhorGrafia(g.grafias), uf: g.uf }))
    .sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR") || a.uf.localeCompare(b.uf));
}
