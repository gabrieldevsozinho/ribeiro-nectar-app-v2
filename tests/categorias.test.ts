/** Categorias de produto: uma lista por empresa, que só o master cria e exclui. */
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIAS_PRODUTO } from "../src/compartilhado/produtos";
import { chamar, consultar, entrar } from "./apoio";

const BASE = "/api/e/apiario-ribeiro";

describe("categorias de produto", () => {
  it("toda empresa já nasce com o conjunto inicial", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const { dados } = await chamar(`${BASE}/produtos/categorias`, { cookie: lucas });
    expect(dados.map((c: { nome: string }) => c.nome).sort()).toEqual([...DEFAULT_CATEGORIAS_PRODUTO].sort());
  });

  it("o master cria uma categoria, não repete o nome (sem diferença de maiúsculas) e o revendedor só lê", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const joao = await entrar("joao@apiarioribeiro.dev");

    const criada = await chamar(`${BASE}/produtos/categorias`, { metodo: "POST", cookie: lucas, corpo: { nome: "Cera de abelha artesanal" } });
    expect(criada.status).toBe(200);
    expect(criada.dados.nome).toBe("Cera de abelha artesanal");

    const repetida = await chamar(`${BASE}/produtos/categorias`, {
      metodo: "POST",
      cookie: lucas,
      corpo: { nome: "  cera de abelha artesanal " },
    });
    expect(repetida.dados.erro).toBe("Já existe uma categoria com este nome.");

    expect((await chamar(`${BASE}/produtos/categorias`, { metodo: "POST", cookie: joao, corpo: { nome: "Outra" } })).status).toBe(403);
    expect((await chamar(`${BASE}/produtos/categorias/${criada.dados.id}`, { metodo: "DELETE", cookie: joao })).status).toBe(403);
  });

  it("recusa excluir uma categoria com produtos (mesmo desativados) e permite depois de mudá-los", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const [emUso] = await consultar<{ id: string }>(
      "select c.id from categorias_produto c join produtos p on p.categoria_id = c.id where c.nome = 'Mel' and c.empresa_id = (select id from empresas where slug = 'apiario-ribeiro') limit 1",
    );

    const recusada = await chamar(`${BASE}/produtos/categorias/${emUso.id}`, { metodo: "DELETE", cookie: lucas });
    expect(recusada.status).toBe(422);
    expect(recusada.dados.erro).toMatch(/tem produtos cadastrados/);

    // Cria uma categoria vazia e exclui sem problema.
    const vazia = await chamar(`${BASE}/produtos/categorias`, { metodo: "POST", cookie: lucas, corpo: { nome: "Linha de teste" } });
    const excluida = await chamar(`${BASE}/produtos/categorias/${vazia.dados.id}`, { metodo: "DELETE", cookie: lucas });
    expect(excluida.status).toBe(200);
    expect(excluida.dados.sucesso).toBe('Categoria "Linha de teste" excluída.');

    const depois = await chamar(`${BASE}/produtos/categorias`, { cookie: lucas });
    expect(depois.dados.some((c: { id: string }) => c.id === vazia.dados.id)).toBe(false);
  });

  it("é isolado por empresa: a categoria de uma empresa não aparece nem pode ser usada pela outra", async () => {
    const marcos = await entrar("marcos@melsilva.dev", "mel-silva");

    const [ribeiro] = await consultar<{ id: string }>(
      "select id from categorias_produto where empresa_id = (select id from empresas where slug = 'apiario-ribeiro') and nome = 'Mel'",
    );
    const { dados: categoriasSilva } = await chamar(`${BASE.replace("apiario-ribeiro", "mel-silva")}/produtos/categorias`, { cookie: marcos });
    expect(categoriasSilva.some((c: { id: string }) => c.id === ribeiro.id)).toBe(false);

    // Mel Silva tenta cadastrar um produto usando a categoria do Apiário Ribeiro: recusado.
    const produto = await chamar("/api/e/mel-silva/produtos", {
      metodo: "POST",
      cookie: marcos,
      corpo: { nome: "Produto trapaça", categoriaId: ribeiro.id, unidade: "unidade", preco: "10,00" },
    });
    expect(produto.status).toBe(422);
    expect(produto.dados.erro).toBe("Escolha a categoria do produto.");
  });
});
