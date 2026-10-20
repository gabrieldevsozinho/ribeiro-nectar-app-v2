/**
 * Isolamento entre empresas e permissões por papel.
 * No projeto original eram testes de RLS no Postgres; aqui o mesmo comportamento
 * é conferido pela API (que é por onde o navegador acessa os dados) e pelos gatilhos do D1.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ListaVendas, ProdutoCatalogo, VendaResumo } from "../src/compartilhado/tipos";
import { chamar, consultar, empresaId, entrar, entrarAdmin, perfilId } from "./apoio";

let ribeiro: string;
let silva: string;

beforeAll(async () => {
  ribeiro = await empresaId("apiario-ribeiro");
  silva = await empresaId("mel-silva");
});

describe("isolamento entre empresas", () => {
  it("um usuário da empresa A não vê nada da empresa B", async () => {
    const marcos = await entrar("marcos@melsilva.dev", "mel-silva");

    // Pela empresa dele, só aparecem dados dela.
    const vendas = await chamar<ListaVendas>("/api/e/mel-silva/vendas", { cookie: marcos });
    expect(vendas.status).toBe(200);
    expect(vendas.dados.total).toBeGreaterThan(0);
    expect(vendas.dados.vendas.every((v) => v.ponto.cidade === "Campinas")).toBe(true);

    const produtos = await chamar<ProdutoCatalogo[]>("/api/e/mel-silva/produtos", { cookie: marcos });
    expect(produtos.dados.map((p) => p.nome)).toEqual(["Mel de eucalipto", "Mel de eucalipto"]);

    // Pelo endereço da outra empresa, é recusado (e a sessão é encerrada).
    const invasao = await chamar("/api/e/apiario-ribeiro/vendas", { cookie: marcos });
    expect(invasao.status).toBe(403);
    expect(invasao.dados.motivo).toBe("outra-empresa");
  });

  it("a chave do Google Maps de uma empresa nunca chega a usuário de outra", async () => {
    await consultar("update google_maps_empresa set chave = ?, status = 'valida' where empresa_id = ?", "AIzaChaveDeTesteDoRibeiro", ribeiro);

    const bia = await entrar("bia@melsilva.dev", "mel-silva");
    const config = await chamar("/api/e/mel-silva/config-mapa", { cookie: bia });
    expect(config.dados.chave).toBeNull();

    const joao = await entrar("joao@apiarioribeiro.dev");
    const doRibeiro = await chamar("/api/e/apiario-ribeiro/config-mapa", { cookie: joao });
    expect(doRibeiro.dados.chave).toBe("AIzaChaveDeTesteDoRibeiro");

    await consultar("update google_maps_empresa set chave = null, status = 'nao_configurada' where empresa_id = ?", ribeiro);
  });

  it("não é possível registrar venda em ponto de outra empresa", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const [pontoSilva] = await consultar<{ id: string }>("select id from pontos_venda where empresa_id = ? limit 1", silva);
    const [produto] = await consultar<{ id: string }>("select id from produtos where empresa_id = ? limit 1", ribeiro);

    const tentativa = await chamar("/api/e/apiario-ribeiro/vendas", {
      metodo: "POST",
      cookie: joao,
      corpo: { pontoId: pontoSilva.id, itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 10 }] },
    });
    expect(tentativa.status).toBe(422);

    // Nem gravando direto no banco: o gatilho recusa.
    await expect(
      consultar("insert into vendas (id, empresa_id, ponto_venda_id, vendedor_id) values (?, ?, ?, ?)",
        crypto.randomUUID(), ribeiro, pontoSilva.id, await perfilId("joao@apiarioribeiro.dev")),
    ).rejects.toThrow(/EMPRESA_INVALIDA/);
  });

  it("visitante sem login não lê nada, só o nome público da empresa", async () => {
    for (const caminho of ["vendas", "produtos", "pontos", "mapa", "config-mapa", "revendedores", "perfil"]) {
      const { status, dados } = await chamar(`/api/e/apiario-ribeiro/${caminho}`);
      expect(status, caminho).toBe(401);
      expect(dados.motivo).toBe("anonimo");
    }
    expect((await chamar("/api/admin/empresas")).status).toBe(401);

    const { dados } = await chamar("/api/publico/empresas/apiario-ribeiro");
    expect(dados).toEqual({ nome: "Apiário Ribeiro", ativa: true });
  });
});

/** Todas as vendas visíveis para um usuário (percorre as páginas). */
async function todasAsVendas(cookie: string): Promise<VendaResumo[]> {
  const vendas: VendaResumo[] = [];
  for (let pagina = 1; ; pagina++) {
    const { dados } = await chamar<ListaVendas>(`/api/e/apiario-ribeiro/vendas?pagina=${pagina}`, { cookie });
    vendas.push(...dados.vendas);
    if (pagina >= dados.paginas) return vendas;
  }
}

describe("vendas visíveis por papel", () => {
  it("o revendedor vê só as próprias vendas", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const vendas = await todasAsVendas(joao);
    const [{ total }] = await consultar<{ total: number }>(
      "select count(*) total from vendas where vendedor_id = ?",
      await perfilId("joao@apiarioribeiro.dev"),
    );
    expect(vendas.length).toBe(total);
    expect(vendas.every((v) => v.vendedor === "João Pereira")).toBe(true);
  });

  it("o master vê as vendas dos revendedores, as próprias e as dos masters que compartilham", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const vistosPorLucas = new Set((await todasAsVendas(lucas)).map((v) => v.vendedor));
    expect(vistosPorLucas.has("Lucas Ribeiro")).toBe(true);
    expect(vistosPorLucas.has("Ana Ribeiro")).toBe(false); // Ana não compartilha
    expect(vistosPorLucas.size).toBe(5); // 4 revendedores + ele mesmo

    const ana = await entrar("ana@apiarioribeiro.dev");
    const vistosPorAna = new Set((await todasAsVendas(ana)).map((v) => v.vendedor));
    expect(vistosPorAna.has("Lucas Ribeiro")).toBe(true); // Lucas compartilha
    expect(vistosPorAna.has("Ana Ribeiro")).toBe(true);
  });

  it("o master não abre a venda de outro master que não compartilha", async () => {
    const [vendaDaAna] = await consultar<{ id: string }>(
      "select id from vendas where vendedor_id = ? limit 1",
      await perfilId("ana@apiarioribeiro.dev"),
    );
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    expect((await chamar(`/api/e/apiario-ribeiro/vendas/${vendaDaAna.id}`, { cookie: lucas })).status).toBe(404);
  });

  it("o revendedor não vê o cadastro dos outros usuários", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const lista = await chamar("/api/e/apiario-ribeiro/revendedores", { cookie: joao });
    expect(lista.status).toBe(403);
    expect(lista.dados.motivo).toBe("so-master");
  });
});

describe("vendas e itens são só de acréscimo", () => {
  it("itens não podem ser alterados nem removidos, nem direto no banco", async () => {
    const [item] = await consultar<{ id: string }>("select id from itens_venda limit 1");
    await expect(consultar("update itens_venda set quantidade_milesimos = 999000 where id = ?", item.id)).rejects.toThrow(/ITEM_IMUTAVEL/);
    await expect(consultar("delete from itens_venda where id = ?", item.id)).rejects.toThrow(/ITEM_IMUTAVEL/);
  });

  it("vendas não podem ser apagadas nem ter os dados trocados", async () => {
    const [venda] = await consultar<{ id: string }>("select id from vendas limit 1");
    await expect(consultar("delete from vendas where id = ?", venda.id)).rejects.toThrow(/VENDA_IMUTAVEL/);
    await expect(consultar("update vendas set data_venda = '2000-01-01T00:00:00.000Z' where id = ?", venda.id)).rejects.toThrow(
      /VENDA_IMUTAVEL/,
    );
  });

  it("o total da venda volta ao certo se alguém tentar gravar outro valor", async () => {
    const [venda] = await consultar<{ id: string; valor_total_centavos: number }>("select id, valor_total_centavos from vendas limit 1");
    await consultar("update vendas set valor_total_centavos = 1 where id = ?", venda.id);
    const [depois] = await consultar<{ valor_total_centavos: number }>("select valor_total_centavos from vendas where id = ?", venda.id);
    expect(depois.valor_total_centavos).toBe(venda.valor_total_centavos);
  });
});

describe("cadastro e configurações", () => {
  it("o usuário só altera campos permitidos do próprio perfil", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const meuId = await perfilId("joao@apiarioribeiro.dev");
    const [antes] = await consultar<{ telefone: string }>("select telefone from perfis where id = ?", meuId);

    const resposta = await chamar("/api/e/apiario-ribeiro/perfil", {
      metodo: "PUT",
      cookie: joao,
      corpo: { nome: "João Pereira", telefone: "(16) 90000-0000", endereco: "", papel: "master", bloqueado: false, compartilhaVendas: true },
    });
    expect(resposta.status).toBe(200);

    const [depois] = await consultar<{ papel: string; telefone: string; compartilha_vendas: number }>(
      "select papel, telefone, compartilha_vendas from perfis where id = ?",
      meuId,
    );
    expect(depois.papel).toBe("revendedor");
    expect(depois.compartilha_vendas).toBe(0);
    expect(depois.telefone).toBe("(16) 90000-0000");
    await consultar("update perfis set telefone = ? where id = ?", antes.telefone, meuId);
  });

  it("o revendedor não altera a chave do Google Maps; o master altera", async () => {
    const corpo = { chave: "AIzaSyA1234567890abcdefghijklmnopqrstuv", resultado: { ok: true }, origem: "https://ribeironectar.test" };

    const joao = await entrar("joao@apiarioribeiro.dev");
    expect((await chamar("/api/e/apiario-ribeiro/google-maps", { metodo: "PUT", cookie: joao, corpo })).status).toBe(403);

    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const doMaster = await chamar("/api/e/apiario-ribeiro/google-maps", { metodo: "PUT", cookie: lucas, corpo });
    expect(doMaster.status).toBe(200);
    const [config] = await consultar<{ chave: string; status: string }>("select chave, status from google_maps_empresa where empresa_id = ?", ribeiro);
    expect(config).toEqual({ chave: corpo.chave, status: "valida" });

    await chamar("/api/e/apiario-ribeiro/google-maps", { metodo: "DELETE", cookie: lucas });
    const [removida] = await consultar<{ status: string }>("select status from google_maps_empresa where empresa_id = ?", ribeiro);
    expect(removida.status).toBe("nao_configurada");
  });

  it("o revendedor não edita o catálogo", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const tentativa = await chamar("/api/e/apiario-ribeiro/produtos", {
      metodo: "POST",
      cookie: joao,
      corpo: { nome: "Falso", unidade: "un", preco: "1" },
    });
    expect(tentativa.status).toBe(403);
  });

  it("o admin da plataforma vê as empresas e o status do Maps, mas nenhuma venda nem chave", async () => {
    const admin = await entrarAdmin();
    const empresas = await chamar("/api/admin/empresas", { cookie: admin });
    expect(empresas.dados).toHaveLength(2);
    expect(JSON.stringify(empresas.dados)).not.toContain("chave");
    expect(empresas.dados[0].maps).toHaveProperty("status");

    const vendas = await chamar("/api/e/apiario-ribeiro/vendas", { cookie: admin });
    expect(vendas.status).toBe(403);
    expect(vendas.dados.motivo).toBe("admin");
  });

  it("um usuário comum não entra no painel da plataforma", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const tentativa = await chamar("/api/admin/empresas", { cookie: lucas });
    expect(tentativa.status).toBe(403);
    expect(tentativa.dados.motivo).toBe("sem-permissao");
  });
});

describe("bloqueio e limite do plano", () => {
  const emailMaria = "maria@apiarioribeiro.dev";

  afterAll(async () => {
    await consultar("update perfis set bloqueado = 0 where email = ?", emailMaria);
  });

  it("usuário bloqueado deixa de ver qualquer dado, mesmo com sessão aberta", async () => {
    const maria = await entrar(emailMaria);
    expect((await chamar("/api/e/apiario-ribeiro/vendas", { cookie: maria })).status).toBe(200);

    await consultar("update perfis set bloqueado = 1 where email = ?", emailMaria);

    const depois = await chamar("/api/e/apiario-ribeiro/vendas", { cookie: maria });
    expect(depois.status).toBe(403);
    expect(depois.dados.motivo).toBe("bloqueado");
    // A sessão foi encerrada: a próxima chamada já chega sem login.
    expect((await chamar("/api/e/apiario-ribeiro/produtos", { cookie: maria })).status).toBe(401);
  });

  it("o master bloqueia pelo sistema: as sessões abertas caem e o login é recusado", async () => {
    const pedro = await entrar("pedro@apiarioribeiro.dev");
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const pedroId = await perfilId("pedro@apiarioribeiro.dev");

    const bloqueio = await chamar(`/api/e/apiario-ribeiro/revendedores/${pedroId}/bloqueio`, {
      metodo: "PATCH",
      cookie: lucas,
      corpo: { bloquear: true },
    });
    expect(bloqueio.dados.sucesso).toBe("Pedro Alves foi bloqueado.");
    expect((await chamar("/api/e/apiario-ribeiro/vendas", { cookie: pedro })).status).toBe(401);

    const login = await chamar("/api/sessao/entrar", {
      metodo: "POST",
      corpo: { slug: "apiario-ribeiro", email: "pedro@apiarioribeiro.dev", senha: "Mel-dev-2026" },
      ip: "10.9.9.9",
    });
    expect(login.dados.erro).toMatch(/acesso está bloqueado/);

    await chamar(`/api/e/apiario-ribeiro/revendedores/${pedroId}/bloqueio`, { metodo: "PATCH", cookie: lucas, corpo: { bloquear: false } });
  });

  it("o banco recusa um master além do limite do plano", async () => {
    // Apiário Ribeiro tem 2 masters e limite 3: o 3º entra, o 4º é recusado.
    const terceiro = crypto.randomUUID();
    await consultar("insert into perfis (id, empresa_id, papel, nome, email) values (?, ?, 'master', 'Terceiro', 'terceiro@teste.dev')", terceiro, ribeiro);
    await expect(
      consultar("insert into perfis (id, empresa_id, papel, nome, email) values (?, ?, 'master', 'Quarto', 'quarto@teste.dev')", crypto.randomUUID(), ribeiro),
    ).rejects.toThrow(/LIMITE_PLANO/);

    // Excluir libera a vaga.
    await consultar("update perfis set excluido_em = ?, email = null where id = ?", new Date().toISOString(), terceiro);
    const quarto = crypto.randomUUID();
    await consultar("insert into perfis (id, empresa_id, papel, nome, email) values (?, ?, 'master', 'Quarto', 'quarto@teste.dev')", quarto, ribeiro);
    await consultar("update perfis set excluido_em = ?, email = null where id = ?", new Date().toISOString(), quarto);
  });

  it("a API mostra a mensagem do limite ao cadastrar revendedor além do plano", async () => {
    await consultar("update empresas set limite_revendedores = 5 where id = ?", ribeiro);
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const tentativa = await chamar("/api/e/apiario-ribeiro/revendedores", {
      metodo: "POST",
      cookie: lucas,
      corpo: { nome: "Sexto", email: "sexto@teste.dev", telefone: "", endereco: "", senha: "favo-2k3m-45" },
    });
    expect(tentativa.status).toBe(422);
    expect(tentativa.dados.erro).toBe("Limite do seu plano atingido. Fale com a Gabriel Studio para ampliar.");
    await consultar("update empresas set limite_revendedores = 10 where id = ?", ribeiro);
  });
});
