/** Login, primeiro acesso, cadastro e exclusão de revendedor, painel do admin. */
import { describe, expect, it } from "vitest";
import { SENHA_DEV } from "../src/worker/seed/demo";
import { chamar, consultar, cookiesDe, entrar, entrarAdmin } from "./apoio";

const login = (email: string, senha = SENHA_DEV, slug = "apiario-ribeiro", ip = "10.1.1.1") =>
  chamar("/api/sessao/entrar", { metodo: "POST", corpo: { slug, email, senha }, ip });

describe("login", () => {
  it("usuário de outra empresa é recusado e não fica com sessão", async () => {
    const tentativa = await login("marcos@melsilva.dev", SENHA_DEV, "apiario-ribeiro", "10.2.0.1");
    expect(tentativa.dados.erro).toBe("Este usuário não pertence a esta empresa.");
    expect(tentativa.resposta.headers.getSetCookie()).toHaveLength(0);
  });

  it("senha errada dá a mesma mensagem de e-mail inexistente", async () => {
    expect((await login("joao@apiarioribeiro.dev", "errada-123", "apiario-ribeiro", "10.2.0.2")).dados.erro).toBe("E-mail ou senha incorretos.");
    expect((await login("ninguem@teste.dev", "errada-123", "apiario-ribeiro", "10.2.0.3")).dados.erro).toBe("E-mail ou senha incorretos.");
  });

  it("o admin não entra pela tela de empresa", async () => {
    const tentativa = await login("admin@ribeironectar.dev", SENHA_DEV, "apiario-ribeiro", "10.2.0.4");
    expect(tentativa.dados.erro).toBe("Este é um acesso da plataforma. Entre por /admin/login.");
  });

  it("muitas tentativas do mesmo IP são barradas", async () => {
    // Limite do ambiente de desenvolvimento (os testes rodam nele): 100 por minuto. Em produção são 10.
    let ultima = 0;
    for (let i = 0; i < 100; i++) ultima = (await login("joao@apiarioribeiro.dev", "errada-123", "apiario-ribeiro", "10.3.3.3")).status;
    const bloqueada = await login("joao@apiarioribeiro.dev", SENHA_DEV, "apiario-ribeiro", "10.3.3.3");
    expect(ultima).toBe(422);
    expect(bloqueada.dados.erro).toBe("Muitas tentativas de login. Aguarde um minuto e tente de novo.");
  });

  it("empresa desativada não entra", async () => {
    await consultar("update empresas set ativa = 0 where slug = 'mel-silva'");
    const tentativa = await login("marcos@melsilva.dev", SENHA_DEV, "mel-silva", "10.2.0.5");
    expect(tentativa.dados.erro).toBe("O acesso desta empresa está suspenso. Fale com a Gabriel Studio.");
    await consultar("update empresas set ativa = 1 where slug = 'mel-silva'");
  });
});

describe("primeiro acesso", () => {
  it("obriga a trocar a senha temporária antes de qualquer tela", async () => {
    const entrada = await login("novo@apiarioribeiro.dev", SENHA_DEV, "apiario-ribeiro", "10.4.0.1");
    expect(entrada.dados.destino).toBe("/apiario-ribeiro/primeiro-acesso");
    const cookie = cookiesDe(entrada.resposta);

    const vendas = await chamar("/api/e/apiario-ribeiro/vendas", { cookie });
    expect(vendas.dados.motivo).toBe("trocar-senha");

    const igual = await chamar("/api/e/apiario-ribeiro/primeiro-acesso", { metodo: "POST", cookie, corpo: { senha: SENHA_DEV, confirmacao: SENHA_DEV } });
    expect(igual.dados.erro).toBe("A nova senha precisa ser diferente da senha temporária.");

    const troca = await chamar("/api/e/apiario-ribeiro/primeiro-acesso", {
      metodo: "POST",
      cookie,
      corpo: { senha: "Favo-teste-2026", confirmacao: "Favo-teste-2026" },
    });
    expect(troca.dados.destino).toBe("/apiario-ribeiro/vendas");
    expect((await chamar("/api/e/apiario-ribeiro/vendas", { cookie })).status).toBe(200);

    // A senha nova passa a valer; a temporária, não.
    expect((await login("novo@apiarioribeiro.dev", SENHA_DEV, "apiario-ribeiro", "10.4.0.2")).dados.erro).toBe("E-mail ou senha incorretos.");
    expect((await login("novo@apiarioribeiro.dev", "Favo-teste-2026", "apiario-ribeiro", "10.4.0.3")).status).toBe(200);
  });
});

describe("revendedores", () => {
  it("o master cadastra um revendedor, que entra com a senha temporária", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const cadastro = await chamar("/api/e/apiario-ribeiro/revendedores", {
      metodo: "POST",
      cookie: lucas,
      corpo: { nome: "Bruno Teste", email: "Bruno@Teste.dev", telefone: "(16) 90000-1111", endereco: "", senha: "favo-2k3m-45" },
    });
    expect(cadastro.dados.credencial).toEqual({ email: "bruno@teste.dev", senha: "favo-2k3m-45", endereco: "/apiario-ribeiro" });

    const repetido = await chamar("/api/e/apiario-ribeiro/revendedores", {
      metodo: "POST",
      cookie: lucas,
      corpo: { nome: "Outro Bruno", email: "bruno@teste.dev", telefone: "", endereco: "", senha: "favo-2k3m-45" },
    });
    expect(repetido.dados.erro).toBe("Já existe um usuário com este e-mail.");

    const entrada = await login("bruno@teste.dev", "favo-2k3m-45", "apiario-ribeiro", "10.5.0.1");
    expect(entrada.dados.destino).toBe("/apiario-ribeiro/primeiro-acesso");
  });

  it("a exclusão é confirmada pelo nome do revendedor, anonimiza e mantém as vendas", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const [carla] = await consultar<{ id: string; user_id: string }>("select id, user_id from perfis where email = 'carla@apiarioribeiro.dev'");
    const [{ vendas }] = await consultar<{ vendas: number }>("select count(*) vendas from vendas where vendedor_id = ?", carla.id);
    const excluir = (confirmacao: string, cookie = lucas) =>
      chamar(`/api/e/apiario-ribeiro/revendedores/${carla.id}/exclusao`, { metodo: "POST", cookie, corpo: { confirmacao } });

    // O revendedor não exclui ninguém, nem com o nome certo.
    const joao = await entrar("joao@apiarioribeiro.dev");
    expect((await excluir("Carla Mendes", joao)).status).toBe(403);

    const errado = await excluir("Carla");
    expect(errado.status).toBe(422);
    expect(errado.dados.erro).toBe("Para confirmar, digite o nome do revendedor: Carla Mendes.");

    // Sem diferença de maiúsculas, acentos e espaços.
    const certo = await excluir("  carla   MENDES ");
    expect(certo.dados).toEqual({ sucesso: "Carla Mendes foi excluído." });

    const [depois] = await consultar<{ nome: string; email: string | null; user_id: string | null; excluido_em: string | null }>(
      "select nome, email, user_id, excluido_em from perfis where id = ?",
      carla.id,
    );
    expect(depois).toMatchObject({ nome: "Revendedor removido", email: null, user_id: null });
    expect(depois.excluido_em).not.toBeNull();
    expect(await consultar("select id from auth_usuarios where id = ?", carla.user_id)).toHaveLength(0);
    const [{ vendasDepois }] = await consultar<{ vendasDepois: number }>("select count(*) vendasDepois from vendas where vendedor_id = ?", carla.id);
    expect(vendasDepois).toBe(vendas);

    // Já excluído: não acha de novo.
    expect((await excluir("Carla Mendes")).dados.erro).toBe("Revendedor não encontrado.");
  });
});

describe("painel do admin", () => {
  it("cadastra uma empresa com o master inicial e não deixa repetir o endereço", async () => {
    const admin = await entrarAdmin();
    const corpo = {
      nome: "Mel da Serra",
      slug: "mel-da-serra",
      limiteMasters: "3",
      limiteRevendedores: "10",
      master: { nome: "Sara Serra", email: "sara@meldaserra.dev", telefone: "", senha: "favo-7k3m-92" },
    };
    const criada = await chamar("/api/admin/empresas", { metodo: "POST", cookie: admin, corpo });
    expect(criada.dados.credencial).toEqual({ email: "sara@meldaserra.dev", senha: "favo-7k3m-92", endereco: "/mel-da-serra" });
    const [maps] = await consultar<{ status: string }>(
      "select g.status from google_maps_empresa g join empresas e on e.id = g.empresa_id where e.slug = 'mel-da-serra'",
    );
    expect(maps.status).toBe("nao_configurada");

    const repetida = await chamar("/api/admin/empresas", { metodo: "POST", cookie: admin, corpo: { ...corpo, master: { ...corpo.master, email: "x@y.dev" } } });
    expect(repetida.dados.erro).toBe("Já existe uma empresa com este endereço.");

    const reservado = await chamar("/api/admin/empresas", { metodo: "POST", cookie: admin, corpo: { ...corpo, slug: "admin" } });
    expect(reservado.dados.erro).toMatch(/^Endereço inválido/);
  });

  it("não deixa o limite ficar abaixo do que já está em uso", async () => {
    const admin = await entrarAdmin();
    const [ribeiro] = await consultar<{ id: string }>("select id from empresas where slug = 'apiario-ribeiro'");
    const alteracao = await chamar(`/api/admin/empresas/${ribeiro.id}`, {
      metodo: "PUT",
      cookie: admin,
      corpo: { nome: "Apiário Ribeiro", limiteMasters: "1", limiteRevendedores: "10" },
    });
    expect(alteracao.dados.erro).toBe("A empresa já tem 2 masters. O limite não pode ser menor que isso.");
  });
});
