/**
 * O admin da plataforma edita e exclui masters. O que importa: trocar e-mail ou senha não faz nada sumir
 * (as vendas e os cadastros apontam para o cadastro do master, não para o e-mail), e a exclusão não esconde
 * as vendas dele dos outros masters.
 */
import { describe, expect, it } from "vitest";
import { SENHA_DEV } from "../src/worker/seed/demo";
import { chamar, consultar, entrar, entrarAdmin } from "./apoio";

const login = (email: string, senha: string, ip: string) =>
  chamar("/api/sessao/entrar", { metodo: "POST", corpo: { slug: "apiario-ribeiro", email, senha }, ip });

async function idDoPerfil(email: string) {
  const [linha] = await consultar<{ id: string }>("select id from perfis where email = ?", email);
  return linha.id;
}

async function empresaDoRibeiro() {
  const [linha] = await consultar<{ id: string }>("select id from empresas where slug = 'apiario-ribeiro'");
  return linha.id;
}

describe("admin edita e exclui masters sem perder dados", () => {
  it("trocar e-mail e senha mantém as vendas, derruba as sessões e vale no próximo login", async () => {
    const admin = await entrarAdmin();
    const empresa = await empresaDoRibeiro();
    const [ana] = await consultar<{ id: string; user_id: string }>("select id, user_id from perfis where email = 'ana@apiarioribeiro.dev'");
    const [{ antes }] = await consultar<{ antes: number }>("select count(*) antes from vendas where vendedor_id = ?", ana.id);
    expect(antes).toBeGreaterThan(0);
    const sessaoAberta = await entrar("ana@apiarioribeiro.dev");

    const troca = await chamar(`/api/admin/empresas/${empresa}/masters/${ana.id}`, {
      metodo: "PUT",
      cookie: admin,
      corpo: { nome: "Ana R. Ribeiro", email: "Ana.Nova@ApiarioRibeiro.dev", telefone: "(16) 90000-0002", senha: "favo-9k2m-71" },
    });
    expect(troca.dados.credencial).toEqual({ email: "ana.nova@apiarioribeiro.dev", senha: "favo-9k2m-71" });

    // O e-mail mudou nos dois lugares, e o cadastro (com as vendas ligadas a ele) é o mesmo.
    const [perfil] = await consultar<{ id: string; email: string; nome: string; deve_trocar_senha: number }>(
      "select id, email, nome, deve_trocar_senha from perfis where id = ?",
      ana.id,
    );
    const [conta] = await consultar<{ email: string }>("select email from auth_usuarios where id = ?", ana.user_id);
    expect(perfil).toMatchObject({ id: ana.id, email: "ana.nova@apiarioribeiro.dev", nome: "Ana R. Ribeiro", deve_trocar_senha: 1 });
    expect(conta.email).toBe("ana.nova@apiarioribeiro.dev");
    const [{ depois }] = await consultar<{ depois: number }>("select count(*) depois from vendas where vendedor_id = ?", ana.id);
    expect(depois).toBe(antes);

    // A sessão antiga caiu; o e-mail antigo não entra mais; o novo entra, pedindo a troca da senha.
    expect((await chamar("/api/e/apiario-ribeiro/vendas", { cookie: sessaoAberta })).status).toBe(401);
    expect((await login("ana@apiarioribeiro.dev", SENHA_DEV, "10.6.0.1")).dados.erro).toBe("E-mail ou senha incorretos.");
    const nova = await login("ana.nova@apiarioribeiro.dev", "favo-9k2m-71", "10.6.0.2");
    expect(nova.dados.destino).toBe("/apiario-ribeiro/primeiro-acesso");

    // Volta ao que era, para os outros testes.
    await chamar(`/api/admin/empresas/${empresa}/masters/${ana.id}`, {
      metodo: "PUT",
      cookie: admin,
      corpo: { nome: "Ana Ribeiro", email: "ana@apiarioribeiro.dev", telefone: "(16) 99999-0002", senha: SENHA_DEV },
    });
    await consultar("update perfis set deve_trocar_senha = 0 where id = ?", ana.id);
  });

  it("não aceita e-mail de outro usuário nem senha fraca, e sem senha a atual continua valendo", async () => {
    const admin = await entrarAdmin();
    const empresa = await empresaDoRibeiro();
    const caminho = `/api/admin/empresas/${empresa}/masters/${await idDoPerfil("lucas@apiarioribeiro.dev")}`;

    const repetido = await chamar(caminho, {
      metodo: "PUT",
      cookie: admin,
      corpo: { nome: "Lucas", email: "ana@apiarioribeiro.dev", telefone: "", senha: "" },
    });
    expect(repetido.dados.erro).toBe("Já existe um usuário com este e-mail.");

    const fraca = await chamar(caminho, {
      metodo: "PUT",
      cookie: admin,
      corpo: { nome: "Lucas", email: "lucas@apiarioribeiro.dev", telefone: "", senha: "abc" },
    });
    expect(fraca.dados.erro).toBe("A senha precisa ter pelo menos 8 caracteres.");

    const semSenha = await chamar(caminho, {
      metodo: "PUT",
      cookie: admin,
      corpo: { nome: "Lucas Ribeiro", email: "lucas@apiarioribeiro.dev", telefone: "(16) 99999-0001", senha: "" },
    });
    expect(semSenha.dados).toEqual({ sucesso: "Dados de Lucas Ribeiro salvos." });
    expect((await login("lucas@apiarioribeiro.dev", SENHA_DEV, "10.6.0.3")).status).toBe(200);
  });

  it("excluir um master anonimiza o cadastro, apaga o login e as vendas dele continuam visíveis para os outros", async () => {
    const admin = await entrarAdmin();
    const empresa = await empresaDoRibeiro();
    const cadastro = await chamar(`/api/admin/empresas/${empresa}/masters`, {
      metodo: "POST",
      cookie: admin,
      corpo: { nome: "Temp Master", email: "temp@apiarioribeiro.dev", telefone: "", senha: "favo-3k4m-56" },
    });
    expect(cadastro.status).toBe(200);
    const [temp] = await consultar<{ id: string; user_id: string }>("select id, user_id from perfis where email = 'temp@apiarioribeiro.dev'");

    // Uma venda dele. Com o compartilhamento desligado (o padrão), só ele a veria.
    const [ponto] = await consultar<{ id: string }>("select id from pontos_venda where empresa_id = ? limit 1", empresa);
    const [produto] = await consultar<{ id: string }>("select id from produtos where empresa_id = ? and ativo = 1 limit 1", empresa);
    const venda = crypto.randomUUID();
    await consultar("insert into vendas (id, empresa_id, ponto_venda_id, vendedor_id) values (?, ?, ?, ?)", venda, empresa, ponto.id, temp.id);
    await consultar(
      "insert into itens_venda (id, venda_id, empresa_id, produto_id, quantidade_milesimos, preco_unitario_centavos, adicionado_por) values (?, ?, ?, ?, 1000, 1000, ?)",
      crypto.randomUUID(),
      venda,
      empresa,
      produto.id,
      temp.id,
    );
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    expect((await chamar(`/api/e/apiario-ribeiro/vendas/${venda}`, { cookie: lucas })).status).toBe(404);

    const exclusao = await chamar(`/api/admin/empresas/${empresa}/masters/${temp.id}`, { metodo: "DELETE", cookie: admin });
    expect(exclusao.dados.sucesso).toMatch(/^Temp Master foi excluído/);

    const [depois] = await consultar<{ nome: string; email: string | null; user_id: string | null; excluido_em: string | null }>(
      "select nome, email, user_id, excluido_em from perfis where id = ?",
      temp.id,
    );
    expect(depois).toMatchObject({ nome: "Master removido", email: null, user_id: null });
    expect(depois.excluido_em).not.toBeNull();
    expect(await consultar("select id from auth_usuarios where id = ?", temp.user_id)).toHaveLength(0);

    // A venda continua, agora visível para os outros masters, com o nome "Master removido".
    const detalhe = await chamar(`/api/e/apiario-ribeiro/vendas/${venda}`, { cookie: lucas });
    expect(detalhe.status).toBe(200);
    expect(detalhe.dados.vendedor).toBe("Master removido");
    expect((await login("temp@apiarioribeiro.dev", "favo-3k4m-56", "10.6.0.4")).dados.erro).toBe("E-mail ou senha incorretos.");

    // A vaga foi liberada e o e-mail pode ser usado de novo.
    const outra = await chamar(`/api/admin/empresas/${empresa}/masters`, {
      metodo: "POST",
      cookie: admin,
      corpo: { nome: "Temp Dois", email: "temp@apiarioribeiro.dev", telefone: "", senha: "favo-3k4m-56" },
    });
    expect(outra.status).toBe(200);
    const [dois] = await consultar<{ id: string }>("select id from perfis where email = 'temp@apiarioribeiro.dev'");
    await chamar(`/api/admin/empresas/${empresa}/masters/${dois.id}`, { metodo: "DELETE", cookie: admin });
  });

  it("a empresa nunca fica sem master", async () => {
    const admin = await entrarAdmin();
    const [silva] = await consultar<{ id: string }>("select id from empresas where slug = 'mel-silva'");
    const marcos = await idDoPerfil("marcos@melsilva.dev");
    const tentativa = await chamar(`/api/admin/empresas/${silva.id}/masters/${marcos}`, { metodo: "DELETE", cookie: admin });
    expect(tentativa.status).toBe(422);
    expect(tentativa.dados.erro).toBe("A empresa precisa ter pelo menos 1 master. Cadastre outro antes de excluir este.");
    expect(await consultar("select id from perfis where id = ? and excluido_em is null", marcos)).toHaveLength(1);
  });

  it("só o admin da plataforma edita ou exclui masters", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const empresa = await empresaDoRibeiro();
    const ana = await idDoPerfil("ana@apiarioribeiro.dev");
    expect((await chamar(`/api/admin/empresas/${empresa}/masters/${ana}`, { metodo: "DELETE", cookie: lucas })).status).toBe(403);
    // A recusa encerra a sessão: para a próxima tentativa ele precisa entrar de novo.
    const edicao = await chamar(`/api/admin/empresas/${empresa}/masters/${ana}`, {
      metodo: "PUT",
      cookie: await entrar("lucas@apiarioribeiro.dev"),
      corpo: { nome: "X Y", email: "x@y.dev", telefone: "", senha: "" },
    });
    expect(edicao.status).toBe(403);
  });
});
