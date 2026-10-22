/**
 * Formato dos dados que a API devolve. Usado pelas telas (React) e pelas rotas (Hono),
 * para os dois lados concordarem. Valores em reais e unidades (a conversão para
 * centavos e milésimos fica no Worker). Datas em texto ISO 8601.
 */
import type { ResultadoTesteMaps } from "./google-maps-erros";

export type Papel = "admin_plataforma" | "master" | "revendedor";
export type StatusGoogleMaps = "nao_configurada" | "valida" | "com_erro";
export type StatusLocalizacao = "pendente" | "automatica" | "ajustada";

/**
 * Por que a API recusou o acesso. A tela usa para decidir para onde mandar:
 * login (com o motivo na tela), primeiro acesso, painel do admin…
 */
export type MotivoAcesso =
  | "anonimo"
  | "bloqueado"
  | "excluido"
  | "empresa-inativa"
  | "outra-empresa"
  | "sem-permissao"
  | "trocar-senha"
  | "admin"
  | "so-master";

/** Corpo de toda resposta de erro da API. */
export type RespostaErro = { erro: string; motivo?: MotivoAcesso };

export type UsuarioLogado = {
  perfilId: string;
  nome: string;
  email: string | null;
  papel: Papel;
  deveTrocarSenha: boolean;
  compartilhaVendas: boolean;
  empresa: { id: string; nome: string; slug: string } | null;
};

/** Dados de login criados por um master ou pelo admin, mostrados uma única vez. */
export type Credencial = { email: string; senha: string; endereco?: string };

export type ResultadoAcao = { sucesso?: string; credencial?: Credencial };

// --- Público -----------------------------------------------------------------------
export type EmpresaPublica = { nome: string; ativa: boolean };
export type UltimaEmpresa = { slug: string; nome: string } | null;

// --- Mapa --------------------------------------------------------------------------
export type ConfigMapaCliente = {
  slug: string;
  provedor: "google" | "osm";
  /** Chave a usar no navegador, ou null se o mapa deve ficar desligado. */
  chave: string | null;
  /** "dev" = chave de teste da Gabriel Studio, só em desenvolvimento. */
  origem: "empresa" | "dev" | null;
  ehMaster: boolean;
  /** Há mapa para mostrar (OpenStreetMap sempre; Google só com chave). */
  disponivel: boolean;
};

/** Partes do endereço usadas para localizar o comércio no mapa. */
export type EnderecoBusca = { logradouro: string; numero: string; bairro: string; cidade: string; uf: string; cep: string };

/**
 * O quanto o ponto encontrado é preciso: "exata" (rua e número), "rua" (a rua, sem o número exato:
 * o OpenStreetMap muitas vezes não tem o número) ou "cidade" (só o centro da cidade).
 */
export type PrecisaoLocalizacao = "exata" | "rua" | "cidade";

export type RespostaGeocodificacao =
  | { ok: true; ponto: { lat: number; lng: number; precisao: PrecisaoLocalizacao } | null }
  | { ok: false };

export type CidadeComVendas = { cidade: string; uf: string; pontos: number; vendas: number; ultimaVenda: string };

export type PontoComVendas = {
  id: string;
  nome: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  localizacaoStatus: StatusLocalizacao;
  vendas: number;
  valorTotal: number;
  ultimaVenda: string;
};

/** Prazos de visita definidos pelo master: até `emDia` dias desde a última venda, em dia; até `atencao`, atenção; depois, atrasado. */
export type PrazosVisita = { emDia: number; atencao: number };

export type DadosMapa = {
  pontos: PontoComVendas[];
  /** null enquanto o master não definir os prazos (o mapa fica sem as cores). */
  prazos: PrazosVisita | null;
  /**
   * Só para o master: pontos sem localização. `aLocalizar` ainda não foram procurados no mapa;
   * `naoEncontrados` foram procurados e não achados (o master ajusta o pino).
   */
  pendentes: { aLocalizar: number; naoEncontrados: PontoPendente[] };
};

/** Cidades dos pontos da empresa, para sugerir no cadastro e não repetir a mesma cidade escrita de outro jeito. */
export type CidadeCadastrada = { cidade: string; uf: string };

// --- Vendas ------------------------------------------------------------------------
export type ItemResumo = { produto: string; unidade: string; quantidade: number; precoUnitario: number; subtotal: number };

export type VendaResumo = {
  id: string;
  dataVenda: string;
  valorTotal: number;
  vendedor: string;
  ponto: { id: string; nome: string; cidade: string; uf: string };
  itens: ItemResumo[];
};

export type PaginaVendas = { vendas: VendaResumo[]; total: number; pagina: number; paginas: number };
export type ListaVendas = PaginaVendas & { soma: number };
export type FiltrosVendasDisponiveis = { cidades: CidadeComVendas[]; vendedores: { id: string; nome: string }[] };

export type PontoEscolha = {
  id: string;
  nome: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
};

/** Categoria do catálogo de produtos (linha, ex.: "Mel"): a empresa cria e exclui as suas. */
export type CategoriaProduto = { id: string; nome: string };

export type ProdutoCatalogo = { id: string; nome: string; categoria: CategoriaProduto | null; unidade: string; precoSugerido: number };
export type Produto = ProdutoCatalogo & { ativo: boolean };

export type DadosNovaVenda = { produtos: ProdutoCatalogo[]; pontoInicial: PontoEscolha | null; recentes: PontoEscolha[] };

export type ItemNovo = { produtoId: string; quantidade: number; precoUnitario: number };

export type VendaDetalhe = {
  id: string;
  dataVenda: string;
  valorTotal: number;
  observacao: string | null;
  vendedor: string;
  ehMinha: boolean;
  ponto: PontoEscolha & { latitude: number | null; longitude: number | null };
  itens: (ItemResumo & { id: string; adicionadoEm: string })[];
  /** Catálogo ativo, só quando a venda é de quem está vendo (para acrescentar itens). */
  produtos: ProdutoCatalogo[];
};

// --- Pontos de venda ---------------------------------------------------------------
export type PontoLista = PontoEscolha & { localizacaoStatus: StatusLocalizacao };
export type ListaPontos = { pontos: PontoLista[]; pendentes: number };

export type DadosPonto = {
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  localizacaoStatus: StatusLocalizacao;
};

export type PontoDetalhe = DadosPonto & { id: string; podeEditar: boolean };

export type PontoPendente = Pick<PontoDetalhe, "id" | "nome" | "logradouro" | "numero" | "bairro" | "cidade" | "uf" | "cep">;

// --- Revendedores e perfil ---------------------------------------------------------
export type ResumoVendedor = { vendas: number; valorTotal: number; ultimaVenda: string };

export type RevendedorLista = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bloqueado: boolean;
  deveTrocarSenha: boolean;
  resumo: ResumoVendedor | null;
};

export type ListaRevendedores = { revendedores: RevendedorLista[]; limite: number };

export type RevendedorDetalhe = {
  revendedor: Omit<RevendedorLista, "resumo"> & { endereco: string | null };
  vendas: { id: string; dataVenda: string; valorTotal: number; ponto: { nome: string; cidade: string; uf: string } }[];
};

export type Perfil = { nome: string; email: string | null; telefone: string | null; endereco: string | null; compartilhaVendas: boolean };

// --- Google Maps -------------------------------------------------------------------
export type ConfigGoogleMaps = {
  provedor: "google" | "osm";
  chave: string | null;
  status: StatusGoogleMaps;
  ultimoErro: string | null;
  validadaEm: string | null;
};

export type CorpoSalvarChave = { chave: string; resultado: ResultadoTesteMaps; origem: string };

// --- Admin da plataforma -----------------------------------------------------------
export type StatusMapsEmpresa = { status: StatusGoogleMaps; validadaEm: string | null; ultimoErro: string | null };

export type EmpresaResumo = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  limiteMasters: number;
  limiteRevendedores: number;
  criadoEm: string;
  masters: number;
  revendedores: number;
  maps: StatusMapsEmpresa;
};

export type EmpresaDetalhe = Omit<EmpresaResumo, "masters" | "revendedores" | "criadoEm"> & {
  emUso: { masters: number; revendedores: number };
  masters: { id: string; nome: string; email: string | null; telefone: string | null; bloqueado: boolean; deveTrocarSenha: boolean }[];
};
