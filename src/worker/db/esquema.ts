/**
 * Esquema do banco (Cloudflare D1 / SQLite), em Drizzle.
 *
 * Multi-tenant: toda tabela de negócio tem empresa_id. Como o SQLite não tem RLS,
 * o isolamento entre empresas é feito em duas camadas:
 *  1. API (src/worker/acesso.ts): toda consulta filtra pela empresa da sessão, nunca pela que vem do navegador;
 *  2. banco: restrições e gatilhos (drizzle/migracoes/0001_gatilhos.sql) recusam dados cruzados entre empresas,
 *     alterações em vendas e itens e cadastros acima do limite do plano.
 *
 * Dinheiro em centavos e quantidade em milésimos (inteiros). Datas em texto ISO 8601 (UTC).
 */
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const agora = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// -----------------------------------------------------------------------------
// Login (Better Auth). Os nomes das propriedades seguem o que o Better Auth espera.
// -----------------------------------------------------------------------------
export const authUsuarios = sqliteTable("auth_usuarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authSessoes = sqliteTable(
  "auth_sessoes",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsuarios.id, { onDelete: "cascade" }),
  },
  (t) => [index("auth_sessoes_usuario_idx").on(t.userId)],
);

export const authContas = sqliteTable(
  "auth_contas",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsuarios.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("auth_contas_usuario_idx").on(t.userId)],
);

export const authVerificacoes = sqliteTable(
  "auth_verificacoes",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("auth_verificacoes_identificador_idx").on(t.identifier)],
);

/** Limite de tentativas de login por IP (guardado no banco: vale para todas as instâncias do Worker). */
export const authLimites = sqliteTable("auth_limites", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

// -----------------------------------------------------------------------------
// Negócio
// -----------------------------------------------------------------------------
export const PAPEIS = ["admin_plataforma", "master", "revendedor"] as const;
export const STATUS_GOOGLE_MAPS = ["nao_configurada", "valida", "com_erro"] as const;
export const STATUS_LOCALIZACAO = ["pendente", "automatica", "ajustada"] as const;

export const empresas = sqliteTable(
  "empresas",
  {
    id: id(),
    nome: text("nome").notNull(),
    slug: text("slug").notNull().unique(),
    ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),
    limiteMasters: integer("limite_masters").notNull().default(3),
    limiteRevendedores: integer("limite_revendedores").notNull().default(10),
    // Prazos de visita do mapa (dias desde a última venda), definidos pelo master. Nulos até ele definir.
    prazoEmDiaDias: integer("prazo_em_dia_dias"),
    prazoAtencaoDias: integer("prazo_atencao_dias"),
    // Reservados para a fase de cobrança (Stripe).
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("empresas_nome", sql`length(trim(${t.nome})) between 2 and 120`),
    // Mesmas regras de src/compartilhado/slug.ts.
    check(
      "empresas_slug",
      sql`length(${t.slug}) between 3 and 60
        and ${t.slug} not glob '*[^a-z0-9-]*'
        and ${t.slug} not like '-%' and ${t.slug} not like '%-' and instr(${t.slug}, '--') = 0
        and ${t.slug} not in ('admin', 'api', 'login', 'sair', 'static', 'public', 'assets', 'favicon-ico', 'icones')`,
    ),
    check("empresas_limite_masters", sql`${t.limiteMasters} >= 1`),
    check("empresas_limite_revendedores", sql`${t.limiteRevendedores} >= 0`),
  ],
);

export const perfis = sqliteTable(
  "perfis",
  {
    id: id(),
    // Fica nulo quando o login é apagado (exclusão de revendedor): o perfil
    // anonimizado continua existindo para manter o histórico de vendas.
    userId: text("user_id")
      .unique()
      .references(() => authUsuarios.id, { onDelete: "set null" }),
    empresaId: text("empresa_id").references(() => empresas.id, { onDelete: "restrict" }),
    papel: text("papel", { enum: PAPEIS }).notNull(),
    nome: text("nome").notNull(),
    email: text("email"),
    telefone: text("telefone"),
    endereco: text("endereco"),
    compartilhaVendas: integer("compartilha_vendas", { mode: "boolean" }).notNull().default(false),
    bloqueado: integer("bloqueado", { mode: "boolean" }).notNull().default(false),
    deveTrocarSenha: integer("deve_trocar_senha", { mode: "boolean" }).notNull().default(true),
    excluidoEm: text("excluido_em"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("perfis_papel", sql`${t.papel} in ('admin_plataforma', 'master', 'revendedor')`),
    check("perfis_nome", sql`length(trim(${t.nome})) between 1 and 120`),
    // O admin da plataforma não tem empresa; todos os outros têm.
    check("perfis_admin_sem_empresa", sql`(${t.papel} = 'admin_plataforma') = (${t.empresaId} is null)`),
    // Só master pode ter a opção de compartilhar vendas ligada.
    check("perfis_compartilha_so_master", sql`${t.papel} = 'master' or ${t.compartilhaVendas} = 0`),
    index("perfis_empresa_papel_idx").on(t.empresaId, t.papel),
    uniqueIndex("perfis_email_unico")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.excluidoEm} is null and ${t.email} is not null`),
  ],
);

export const googleMapsEmpresa = sqliteTable(
  "google_maps_empresa",
  {
    empresaId: text("empresa_id")
      .primaryKey()
      .references(() => empresas.id, { onDelete: "cascade" }),
    chave: text("chave"),
    status: text("status", { enum: STATUS_GOOGLE_MAPS }).notNull().default("nao_configurada"),
    ultimoErro: text("ultimo_erro"),
    validadaEm: text("validada_em"),
    atualizadaPor: text("atualizada_por").references(() => perfis.id),
    atualizadaEm: text("atualizada_em").notNull().default(agora),
  },
  (t) => [
    check("google_maps_status", sql`${t.status} in ('nao_configurada', 'valida', 'com_erro')`),
    check("google_maps_chave_status", sql`(${t.chave} is null) = (${t.status} = 'nao_configurada')`),
  ],
);

/**
 * Categorias do catálogo (linhas como "Mel", "Própolis"…): cada empresa tem as suas, criadas
 * pelo master. `criarEmpresa` já cadastra um conjunto inicial (veja DEFAULT_CATEGORIAS_PRODUTO),
 * que o master edita livremente dali em diante.
 */
export const categoriasProduto = sqliteTable(
  "categorias_produto",
  {
    id: id(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("categorias_produto_nome", sql`length(trim(${t.nome})) between 1 and 60`),
    uniqueIndex("categorias_produto_nome_unico").on(t.empresaId, sql`lower(trim(${t.nome}))`),
  ],
);

/**
 * Unidades do catálogo (tamanhos como "pote 1 kg", "frasco 30 ml"): cada empresa tem as suas,
 * criadas pelo master. `criarEmpresa` já cadastra um conjunto inicial (veja DEFAULT_UNIDADES_PRODUTO),
 * que o master edita livremente dali em diante. A unidade do produto continua guardada como texto
 * livre (produtos.unidade); esta tabela só serve para o dropdown do cadastro.
 */
export const unidadesProduto = sqliteTable(
  "unidades_produto",
  {
    id: id(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("unidades_produto_nome", sql`length(trim(${t.nome})) between 1 and 30`),
    uniqueIndex("unidades_produto_nome_unico").on(t.empresaId, sql`lower(trim(${t.nome}))`),
  ],
);

export const produtos = sqliteTable(
  "produtos",
  {
    id: id(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    // Linha do catálogo (mel, própolis, pólen…), para organizar a tela quando há muitos produtos.
    // Sem FK no banco (uma categoria excluída não pode deixar produto nenhum órfão: o serviço
    // recusa a exclusão enquanto algum produto ainda usa a categoria).
    categoriaId: text("categoria_id"),
    unidade: text("unidade").notNull(),
    precoSugeridoCentavos: integer("preco_sugerido_centavos").notNull(),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("produtos_nome", sql`length(trim(${t.nome})) between 1 and 120`),
    // Sem CHECK na categoria: adicionar um CHECK exigiria recriar a tabela inteira, e o SQLite
    // recusa (erro de chave estrangeira) porque itens_venda referencia produtos. A validação
    // fica no Zod (esquemaProduto), que já recusa qualquer valor fora de CATEGORIAS_PRODUTO.
    check("produtos_unidade", sql`length(trim(${t.unidade})) between 1 and 30`),
    check("produtos_preco", sql`${t.precoSugeridoCentavos} >= 0`),
    uniqueIndex("produtos_nome_unidade_unico").on(t.empresaId, sql`lower(trim(${t.nome}))`, sql`lower(trim(${t.unidade}))`),
  ],
);

export const pontosVenda = sqliteTable(
  "pontos_venda",
  {
    id: id(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    cnpj: text("cnpj"),
    contato: text("contato"),
    telefone: text("telefone"),
    logradouro: text("logradouro").notNull(),
    numero: text("numero"),
    bairro: text("bairro"),
    cidade: text("cidade").notNull(),
    uf: text("uf").notNull(),
    cep: text("cep"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    localizacaoStatus: text("localizacao_status", { enum: STATUS_LOCALIZACAO }).notNull().default("pendente"),
    // Quando a busca automática não achou o endereço: ela não tenta de novo sozinha (o master ajusta o pino).
    localizacaoFalhouEm: text("localizacao_falhou_em"),
    criadoPor: text("criado_por").references(() => perfis.id),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("pontos_nome", sql`length(trim(${t.nome})) between 1 and 160`),
    check("pontos_cnpj", sql`${t.cnpj} is null or (length(${t.cnpj}) = 14 and ${t.cnpj} not glob '*[^0-9]*')`),
    check("pontos_logradouro", sql`length(trim(${t.logradouro})) between 1 and 200`),
    check("pontos_cidade", sql`length(trim(${t.cidade})) between 1 and 120`),
    check("pontos_uf", sql`length(${t.uf}) = 2 and ${t.uf} glob '[A-Z][A-Z]'`),
    check("pontos_cep", sql`${t.cep} is null or (length(${t.cep}) = 8 and ${t.cep} not glob '*[^0-9]*')`),
    check("pontos_latitude", sql`${t.latitude} between -90 and 90`),
    check("pontos_longitude", sql`${t.longitude} between -180 and 180`),
    check("pontos_localizacao_status", sql`${t.localizacaoStatus} in ('pendente', 'automatica', 'ajustada')`),
    check("pontos_coordenadas_completas", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("pontos_status_coordenadas", sql`(${t.localizacaoStatus} = 'pendente') = (${t.latitude} is null)`),
    // Um ponto por comércio: mesmo CNPJ ou mesmo endereço na empresa = mesmo ponto.
    uniqueIndex("pontos_cnpj_unico").on(t.empresaId, t.cnpj).where(sql`${t.cnpj} is not null`),
    // (O drizzle-kit quebra expressões com vírgula dentro de índices: por isso o "case" no lugar do coalesce.)
    uniqueIndex("pontos_endereco_unico").on(
      t.empresaId,
      sql`lower(trim(${t.logradouro}))`,
      sql`lower(trim(case when ${t.numero} is null then '' else ${t.numero} end))`,
      sql`lower(trim(${t.cidade}))`,
      t.uf,
    ),
    index("pontos_cidade_idx").on(t.empresaId, t.uf, t.cidade),
  ],
);

export const vendas = sqliteTable(
  "vendas",
  {
    id: id(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    pontoVendaId: text("ponto_venda_id")
      .notNull()
      .references(() => pontosVenda.id),
    vendedorId: text("vendedor_id")
      .notNull()
      .references(() => perfis.id),
    dataVenda: text("data_venda").notNull().default(agora),
    // Recalculado pelos gatilhos a partir dos itens (nunca gravado pela API).
    valorTotalCentavos: integer("valor_total_centavos").notNull().default(0),
    observacao: text("observacao"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    check("vendas_observacao", sql`${t.observacao} is null or length(${t.observacao}) <= 500`),
    index("vendas_empresa_data_idx").on(t.empresaId, t.dataVenda),
    index("vendas_ponto_data_idx").on(t.pontoVendaId, t.dataVenda),
    index("vendas_vendedor_data_idx").on(t.vendedorId, t.dataVenda),
  ],
);

export const itensVenda = sqliteTable(
  "itens_venda",
  {
    id: id(),
    vendaId: text("venda_id")
      .notNull()
      .references(() => vendas.id, { onDelete: "restrict" }),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produtos.id),
    quantidadeMilesimos: integer("quantidade_milesimos").notNull(),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    subtotalCentavos: integer("subtotal_centavos").generatedAlwaysAs(
      sql`cast(round(quantidade_milesimos * preco_unitario_centavos / 1000.0) as integer)`,
      { mode: "stored" },
    ),
    adicionadoPor: text("adicionado_por").references(() => perfis.id),
    adicionadoEm: text("adicionado_em").notNull().default(agora),
  },
  (t) => [
    check("itens_quantidade", sql`${t.quantidadeMilesimos} > 0`),
    check("itens_preco", sql`${t.precoUnitarioCentavos} >= 0`),
    index("itens_venda_venda_idx").on(t.vendaId),
  ],
);

/**
 * Códigos de confirmação por e-mail da exclusão de revendedor. Sem uso desde que a exclusão passou
 * a ser confirmada digitando o nome do revendedor; a tabela fica para quando houver e-mail configurado.
 */
export const codigosExclusao = sqliteTable(
  "codigos_exclusao",
  {
    id: id(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    revendedorId: text("revendedor_id")
      .notNull()
      .references(() => perfis.id),
    masterId: text("master_id")
      .notNull()
      .references(() => perfis.id),
    codigoHash: text("codigo_hash").notNull(),
    tentativas: integer("tentativas").notNull().default(0),
    expiraEm: text("expira_em").notNull(),
    usadoEm: text("usado_em"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("codigos_exclusao_revendedor_idx").on(t.revendedorId)],
);
