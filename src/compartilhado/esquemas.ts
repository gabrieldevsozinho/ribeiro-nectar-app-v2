/**
 * Formato dos corpos enviados à API (Zod). Conferem tipos e tamanhos; as regras de
 * negócio, com as mensagens para o usuário, ficam nos serviços do Worker.
 */
import { z } from "zod";

/** Texto de formulário: sem espaços nas pontas e com tamanho máximo. */
const texto = (max: number) => z.string().max(max).trim();
const opcional = (max: number) => texto(max).default("");

export const esquemaCredenciais = z.object({
  email: texto(254).toLowerCase(),
  senha: z.string().max(200),
});

export const esquemaEntrarEmpresa = esquemaCredenciais.extend({ slug: texto(60) });

export const esquemaNovaSenha = z.object({
  senha: z.string().max(200),
  confirmacao: z.string().max(200),
});

export const esquemaTrocarSenha = z.object({
  senhaAtual: z.string().max(200),
  senhaNova: z.string().max(200),
  confirmacao: z.string().max(200),
});

export const esquemaPerfil = z.object({
  nome: texto(120),
  telefone: opcional(40),
  endereco: opcional(200),
  compartilhaVendas: z.boolean().optional(),
});

export const esquemaProduto = z.object({
  nome: texto(120),
  unidade: texto(30),
  preco: texto(30),
});

export const esquemaAtivo = z.object({ ativo: z.boolean() });

export const esquemaPonto = z.object({
  nome: texto(160),
  cnpj: opcional(30),
  contato: opcional(120),
  telefone: opcional(40),
  logradouro: texto(200),
  numero: opcional(30),
  bairro: opcional(120),
  cidade: texto(120),
  uf: texto(2),
  cep: opcional(20),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  localizacaoStatus: z.enum(["pendente", "automatica", "ajustada"]),
});

export const esquemaLocalizacao = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(["automatica", "ajustada"]),
});

export const esquemaItens = z
  .array(
    z.object({
      produtoId: z.string().max(40),
      quantidade: z.number(),
      precoUnitario: z.number(),
    }),
  )
  .max(50, "No máximo 50 itens por vez.");

/** Prazos de visita do mapa, em dias (as regras ficam no serviço, com as mensagens). */
export const esquemaPrazos = z.object({ emDia: texto(6), atencao: texto(6) });

export const esquemaRegistrarVenda = z.object({
  pontoId: z.string().max(40),
  itens: esquemaItens,
  observacao: z.string().max(500).default(""),
});

export const esquemaAcrescentarItens = z.object({ itens: esquemaItens });

export const esquemaGeocodificar = z.object({
  logradouro: z.string().max(200).default(""),
  numero: z.string().max(30).default(""),
  bairro: z.string().max(120).default(""),
  cidade: z.string().max(120),
  uf: z.string().max(2),
  cep: z.string().max(20).default(""),
});

export const esquemaNovoUsuario = z.object({
  nome: texto(120),
  email: texto(254).toLowerCase(),
  telefone: opcional(40),
  endereco: opcional(200),
  senha: z.string().max(128),
});

/** Edição de um master pelo admin: a senha é opcional (em branco, a senha atual continua). */
export const esquemaEditarMaster = z.object({
  nome: texto(120),
  email: texto(254).toLowerCase(),
  telefone: opcional(40),
  senha: z.string().max(128).default(""),
});

export const esquemaNovaEmpresa = z.object({
  nome: texto(120),
  slug: texto(60).toLowerCase(),
  limiteMasters: texto(6),
  limiteRevendedores: texto(6),
  master: esquemaNovoUsuario.omit({ endereco: true }),
});

export const esquemaAlterarEmpresa = z.object({
  nome: texto(120),
  limiteMasters: texto(6),
  limiteRevendedores: texto(6),
});

export const esquemaBloqueio = z.object({ bloquear: z.boolean() });
export const esquemaCodigo = z.object({ codigo: z.string().max(20) });

const esquemaResultadoMaps = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), codigo: z.string().max(80), detalhe: z.string().max(300).optional() }),
]);

export const esquemaSalvarChave = z.object({
  chave: z.string().max(100),
  resultado: esquemaResultadoMaps,
  origem: z.string().max(200),
});

export const esquemaFalhaMaps = z.object({ resultado: esquemaResultadoMaps });
