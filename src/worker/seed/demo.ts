/**
 * Dados de demonstração (ambiente local e testes automáticos).
 *
 * Cria duas empresas (Apiário Ribeiro e Mel Silva) para testar o isolamento
 * entre empresas, com masters, revendedores, catálogo, pontos de venda e vendas.
 * Todos os usuários de teste usam a senha SENHA_DEV. Nunca rode contra produção.
 */
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { DEFAULT_CATEGORIAS_PRODUTO } from "@/compartilhado/produtos";
import { gerarHashSenha } from "../auth/senha-hash";
import type { Db } from "../db/cliente";
import { authContas, authUsuarios, categoriasProduto, empresas, itensVenda, perfis, pontosVenda, produtos, vendas } from "../db/esquema";

export const SENHA_DEV = "Mel-dev-2026";

type NovoUsuario = {
  email: string;
  nome: string;
  papel: "admin_plataforma" | "master" | "revendedor";
  empresaId: string | null;
  telefone?: string;
  endereco?: string;
  compartilhaVendas?: boolean;
  deveTrocarSenha?: boolean;
};

type Ponto = {
  nome: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
  cnpj?: string;
  contato?: string;
  telefone?: string;
};

export async function criarDadosDemo(db: Db): Promise<"criado" | "ja-existe"> {
  const existente = await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.slug, "apiario-ribeiro")).get();
  if (existente) return "ja-existe";

  // Gerador pseudoaleatório determinístico: o seed sai igual toda vez.
  let semente = 20261015;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  const escolher = <T>(lista: T[]): T => lista[Math.floor(aleatorio() * lista.length)];

  // Todos usam a mesma senha: um hash só (o PBKDF2 é propositalmente lento).
  const hash = await gerarHashSenha(SENHA_DEV);

  async function criarUsuario(u: NovoUsuario): Promise<string> {
    const userId = crypto.randomUUID();
    const agora = new Date();
    const perfilId = crypto.randomUUID();
    await db.batch([
      db.insert(authUsuarios).values({ id: userId, name: u.nome, email: u.email, emailVerified: true, createdAt: agora, updatedAt: agora }),
      db.insert(authContas).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
        createdAt: agora,
        updatedAt: agora,
      }),
      db.insert(perfis).values({
        id: perfilId,
        userId,
        empresaId: u.empresaId,
        papel: u.papel,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone ?? null,
        endereco: u.endereco ?? null,
        compartilhaVendas: u.compartilhaVendas ?? false,
        deveTrocarSenha: u.deveTrocarSenha ?? false,
      }),
    ]);
    return perfilId;
  }

  async function criarEmpresa(nome: string, slug: string): Promise<string> {
    const criada = await db.insert(empresas).values({ nome, slug }).returning({ id: empresas.id }).get();
    return criada.id;
  }

  /** As categorias iniciais da empresa (mesmas de criarEmpresa() no painel do admin), por nome → id. */
  async function criarCategorias(empresaId: string): Promise<Map<string, string>> {
    const linhas = await db
      .insert(categoriasProduto)
      .values(DEFAULT_CATEGORIAS_PRODUTO.map((nome) => ({ empresaId, nome })))
      .returning({ id: categoriasProduto.id, nome: categoriasProduto.nome });
    return new Map(linhas.map((l) => [l.nome, l.id]));
  }

  // Um comando por ponto: o D1 aceita no máximo 100 valores por comando.
  async function criarPontos(empresaId: string, criadoPor: string, lista: Ponto[]) {
    const ids = lista.map(() => crypto.randomUUID());
    const comandos: BatchItem<"sqlite">[] = lista.map((p, i) =>
      db.insert(pontosVenda).values({
        id: ids[i],
        empresaId,
        nome: p.nome,
        logradouro: p.logradouro,
        numero: p.numero,
        bairro: p.bairro,
        cidade: p.cidade,
        uf: p.uf,
        latitude: p.lat,
        longitude: p.lng,
        localizacaoStatus: p.lat === null ? "pendente" : "automatica",
        cnpj: p.cnpj ?? null,
        contato: p.contato ?? null,
        telefone: p.telefone ?? null,
        criadoPor,
      }),
    );
    await db.batch(comandos as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    return ids;
  }

  async function criarProdutos(
    empresaId: string,
    categorias: Map<string, string>,
    lista: { nome: string; categoria: string; unidade: string; preco: number }[],
  ) {
    return db
      .insert(produtos)
      .values(
        lista.map((p) => ({
          empresaId,
          nome: p.nome,
          categoriaId: categorias.get(p.categoria),
          unidade: p.unidade,
          precoSugeridoCentavos: Math.round(p.preco * 100),
        })),
      )
      .returning({ id: produtos.id, precoSugeridoCentavos: produtos.precoSugeridoCentavos });
  }

  async function criarVendas(
    empresaId: string,
    vendedores: string[],
    pontos: string[],
    catalogo: { id: string; precoSugeridoCentavos: number }[],
    quantidade: number,
  ) {
    for (let i = 0; i < quantidade; i++) {
      const vendedor = escolher(vendedores);
      const diasAtras = Math.floor(aleatorio() * 90);
      const data = new Date(Date.now() - diasAtras * 86_400_000 - Math.floor(aleatorio() * 8) * 3_600_000);
      // Mesma ordem de sorteios do seed original: os dados de demonstração saem iguais.
      const ponto = escolher(pontos);
      const vendaId = crypto.randomUUID();
      const nItens = 1 + Math.floor(aleatorio() * 3);
      const itens = Array.from({ length: nItens }, () => {
        const produto = escolher(catalogo);
        // Às vezes o preço negociado é um pouco diferente do sugerido.
        const ajuste = aleatorio() < 0.25 ? (aleatorio() < 0.5 ? 0.95 : 1.05) : 1;
        return {
          vendaId,
          empresaId,
          produtoId: produto.id,
          quantidadeMilesimos: (1 + Math.floor(aleatorio() * 12)) * 1000,
          precoUnitarioCentavos: Math.round(produto.precoSugeridoCentavos * ajuste),
          adicionadoPor: vendedor,
          adicionadoEm: data.toISOString(),
        };
      });
      const comandos: BatchItem<"sqlite">[] = [
        db.insert(vendas).values({ id: vendaId, empresaId, pontoVendaId: ponto, vendedorId: vendedor, dataVenda: data.toISOString() }),
        ...itens.map((item) => db.insert(itensVenda).values(item)),
      ];
      await db.batch(comandos as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    }
  }

  // --- Plataforma ---------------------------------------------------------------
  await criarUsuario({ email: "admin@ribeironectar.dev", nome: "Gabriel (Gabriel Studio)", papel: "admin_plataforma", empresaId: null });

  // --- Apiário Ribeiro ------------------------------------------------------------
  const ribeiro = await criarEmpresa("Apiário Ribeiro", "apiario-ribeiro");
  const categoriasRibeiro = await criarCategorias(ribeiro);
  const lucas = await criarUsuario({
    email: "lucas@apiarioribeiro.dev",
    nome: "Lucas Ribeiro",
    papel: "master",
    empresaId: ribeiro,
    telefone: "(16) 99999-0001",
    compartilhaVendas: true,
  });
  const ana = await criarUsuario({
    email: "ana@apiarioribeiro.dev",
    nome: "Ana Ribeiro",
    papel: "master",
    empresaId: ribeiro,
    telefone: "(16) 99999-0002",
    compartilhaVendas: false,
  });
  const revendedores = [
    await criarUsuario({ email: "joao@apiarioribeiro.dev", nome: "João Pereira", papel: "revendedor", empresaId: ribeiro, telefone: "(16) 98888-1001", endereco: "Rua das Flores, 120 – Ribeirão Preto/SP" }),
    await criarUsuario({ email: "maria@apiarioribeiro.dev", nome: "Maria Souza", papel: "revendedor", empresaId: ribeiro, telefone: "(16) 98888-1002", endereco: "Av. Brasil, 845 – Franca/SP" }),
    await criarUsuario({ email: "pedro@apiarioribeiro.dev", nome: "Pedro Alves", papel: "revendedor", empresaId: ribeiro, telefone: "(34) 98888-1003", endereco: "Rua Tiradentes, 55 – Uberaba/MG" }),
    await criarUsuario({ email: "carla@apiarioribeiro.dev", nome: "Carla Mendes", papel: "revendedor", empresaId: ribeiro, telefone: "(16) 98888-1004", endereco: "Rua XV de Novembro, 300 – Batatais/SP" }),
  ];
  // Revendedor recém-cadastrado: precisa trocar a senha no primeiro acesso.
  await criarUsuario({ email: "novo@apiarioribeiro.dev", nome: "Rafael Novo", papel: "revendedor", empresaId: ribeiro, telefone: "(16) 98888-1005", deveTrocarSenha: true });

  const produtosRibeiro = await criarProdutos(ribeiro, categoriasRibeiro, [
    { nome: "Mel silvestre", categoria: "Mel", unidade: "pote 1 kg", preco: 45 },
    { nome: "Mel silvestre", categoria: "Mel", unidade: "pote 500 g", preco: 25 },
    { nome: "Mel de laranjeira", categoria: "Mel", unidade: "garrafa 1 L", preco: 38 },
    { nome: "Própolis verde", categoria: "Própolis", unidade: "frasco 30 ml", preco: 22 },
    { nome: "Favo de mel", categoria: "Favo de mel", unidade: "bandeja 300 g", preco: 30 },
    { nome: "Pólen apícola", categoria: "Pólen", unidade: "pote 250 g", preco: 28 },
    { nome: "Geleia real", categoria: "Geleia real", unidade: "frasco 30 g", preco: 55 },
    { nome: "Sabonete de própolis", categoria: "Cosmético", unidade: "unidade", preco: 12 },
  ]);

  const pontosRibeiro = await criarPontos(ribeiro, lucas, [
    { nome: "Empório Bela Vista", logradouro: "Rua Garibaldi", numero: "1020", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", lat: -21.1784, lng: -47.8101, cnpj: "11222333000181", contato: "Sílvia", telefone: "(16) 3610-1000" },
    { nome: "Mercearia do Zé", logradouro: "Av. Nove de Julho", numero: "455", bairro: "Jardim Sumaré", cidade: "Ribeirão Preto", uf: "SP", lat: -21.1902, lng: -47.8064, contato: "José" },
    { nome: "Casa Natural", logradouro: "Rua São Sebastião", numero: "88", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", lat: -21.1751, lng: -47.8128 },
    { nome: "Supermercado Franca Bom", logradouro: "Av. Champagnat", numero: "1500", bairro: "Centro", cidade: "Franca", uf: "SP", lat: -20.5386, lng: -47.4009, cnpj: "22333444000172" },
    { nome: "Padaria Pão de Mel", logradouro: "Rua Voluntários da Franca", numero: "230", bairro: "Centro", cidade: "Franca", uf: "SP", lat: -20.5352, lng: -47.4031 },
    { nome: "Empório Mineiro", logradouro: "Rua Artur Machado", numero: "610", bairro: "Centro", cidade: "Uberaba", uf: "MG", lat: -19.7476, lng: -47.9318 },
    { nome: "Feira da Saúde", logradouro: "Av. Leopoldino de Oliveira", numero: "3300", bairro: "Abadia", cidade: "Uberaba", uf: "MG", lat: -19.7552, lng: -47.9395 },
    { nome: "Armazém Batatais", logradouro: "Praça Cônego Joaquim Alves", numero: "15", bairro: "Centro", cidade: "Batatais", uf: "SP", lat: -20.8911, lng: -47.5854 },
    // Cadastrado sem chave do Google Maps: localização pendente.
    { nome: "Sítio Boa Esperança (venda direta)", logradouro: "Estrada Municipal BTT-020", numero: "km 4", bairro: "Zona rural", cidade: "Batatais", uf: "SP", lat: null, lng: null },
  ]);

  await criarVendas(ribeiro, revendedores, pontosRibeiro, produtosRibeiro, 70);
  await criarVendas(ribeiro, [lucas], pontosRibeiro.slice(0, 3), produtosRibeiro, 6);
  await criarVendas(ribeiro, [ana], pontosRibeiro.slice(3, 5), produtosRibeiro, 4);

  // --- Mel Silva (segunda empresa, para testar o isolamento) ----------------------
  const silva = await criarEmpresa("Mel Silva", "mel-silva");
  const categoriasSilva = await criarCategorias(silva);
  const marcos = await criarUsuario({ email: "marcos@melsilva.dev", nome: "Marcos Silva", papel: "master", empresaId: silva, compartilhaVendas: true });
  const bia = await criarUsuario({ email: "bia@melsilva.dev", nome: "Beatriz Lima", papel: "revendedor", empresaId: silva });
  const produtosSilva = await criarProdutos(silva, categoriasSilva, [
    { nome: "Mel de eucalipto", categoria: "Mel", unidade: "pote 1 kg", preco: 42 },
    { nome: "Mel de eucalipto", categoria: "Mel", unidade: "sachê 10 g", preco: 1.5 },
  ]);
  const pontosSilva = await criarPontos(silva, marcos, [
    { nome: "Mercado Central Campinas", logradouro: "Av. Benjamin Constant", numero: "1200", bairro: "Centro", cidade: "Campinas", uf: "SP", lat: -22.9071, lng: -47.0632 },
    { nome: "Quitanda da Praça", logradouro: "Rua Barão de Jaguara", numero: "900", bairro: "Centro", cidade: "Campinas", uf: "SP", lat: -22.9035, lng: -47.0598 },
  ]);
  await criarVendas(silva, [bia, marcos], pontosSilva, produtosSilva, 12);

  return "criado";
}
