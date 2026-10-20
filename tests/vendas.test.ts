/** Registro de venda e acréscimo de itens (equivalem a registrar_venda e acrescentar_itens do original). */
import { describe, expect, it } from "vitest";
import type { VendaDetalhe } from "../src/compartilhado/tipos";
import { chamar, consultar, entrar, perfilId } from "./apoio";

async function contarVendas() {
  const [{ total }] = await consultar<{ total: number }>("select count(*) total from vendas");
  return total;
}

async function pontoEProdutos(cookie: string) {
  const { dados: pontos } = await chamar("/api/e/apiario-ribeiro/pontos", { cookie });
  const { dados: produtos } = await chamar("/api/e/apiario-ribeiro/produtos", { cookie });
  return { ponto: pontos.pontos[0].id as string, produtos: produtos.map((p: { id: string }) => p.id) as string[] };
}

describe("registrar venda", () => {
  it("grava a venda e os itens juntos, com o total calculado", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const { ponto, produtos } = await pontoEProdutos(joao);

    const registro = await chamar("/api/e/apiario-ribeiro/vendas", {
      metodo: "POST",
      cookie: joao,
      corpo: {
        pontoId: ponto,
        itens: [
          { produtoId: produtos[0], quantidade: 2, precoUnitario: 10.5 },
          { produtoId: produtos[1], quantidade: 1.5, precoUnitario: 4 },
        ],
        observacao: "teste automático",
      },
    });
    expect(registro.status).toBe(200);

    const venda = await chamar<VendaDetalhe>(`/api/e/apiario-ribeiro/vendas/${registro.dados.id}`, { cookie: joao });
    expect(venda.dados.valorTotal).toBeCloseTo(27, 2);
    expect(venda.dados.vendedor).toBe("João Pereira");
    expect(venda.dados.ehMinha).toBe(true);
    expect(venda.dados.itens.map((i) => i.quantidade)).toEqual([2, 1.5]);
    expect(venda.dados.observacao).toBe("teste automático");
  });

  it("se um item for inválido, nada é gravado", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const { ponto, produtos } = await pontoEProdutos(joao);
    const antes = await contarVendas();

    const tentativa = await chamar("/api/e/apiario-ribeiro/vendas", {
      metodo: "POST",
      cookie: joao,
      corpo: {
        pontoId: ponto,
        itens: [
          { produtoId: produtos[0], quantidade: 1, precoUnitario: 10 },
          { produtoId: produtos[0], quantidade: -3, precoUnitario: 10 },
        ],
      },
    });
    expect(tentativa.status).toBe(422);
    expect(tentativa.dados.erro).toBe("Confira as quantidades.");
    expect(await contarVendas()).toBe(antes);
  });

  it("não aceita venda sem itens nem produto desativado (e o lote inteiro é desfeito)", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const { ponto, produtos } = await pontoEProdutos(joao);

    const semItens = await chamar("/api/e/apiario-ribeiro/vendas", { metodo: "POST", cookie: joao, corpo: { pontoId: ponto, itens: [] } });
    expect(semItens.dados.erro).toBe("Adicione pelo menos um item.");

    const [propolis] = await consultar<{ id: string }>("select id from produtos where nome = 'Própolis verde'");
    await consultar("update produtos set ativo = 0 where id = ?", propolis.id);
    const antes = await contarVendas();
    const inativo = await chamar("/api/e/apiario-ribeiro/vendas", {
      metodo: "POST",
      cookie: joao,
      corpo: {
        pontoId: ponto,
        itens: [
          { produtoId: produtos[0], quantidade: 1, precoUnitario: 10 },
          { produtoId: propolis.id, quantidade: 1, precoUnitario: 22 },
        ],
      },
    });
    expect(inativo.dados.erro).toBe("Um dos produtos saiu do catálogo. Atualize a página e escolha de novo.");
    expect(await contarVendas()).toBe(antes);
    await consultar("update produtos set ativo = 1 where id = ?", propolis.id);
  });
});

describe("acrescentar itens", () => {
  it("só quem registrou a venda acrescenta itens (nem o master)", async () => {
    const [vendaDaMaria] = await consultar<{ id: string }>(
      "select id from vendas where vendedor_id = ? limit 1",
      await perfilId("maria@apiarioribeiro.dev"),
    );
    const item = async (cookie: string) => {
      const { produtos } = await pontoEProdutos(cookie);
      return { itens: [{ produtoId: produtos[0], quantidade: 1, precoUnitario: 1 }] };
    };

    const joao = await entrar("joao@apiarioribeiro.dev");
    const doJoao = await chamar(`/api/e/apiario-ribeiro/vendas/${vendaDaMaria.id}/itens`, { metodo: "POST", cookie: joao, corpo: await item(joao) });
    expect(doJoao.dados.erro).toBe("Só quem registrou a venda pode acrescentar itens.");

    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const doMaster = await chamar(`/api/e/apiario-ribeiro/vendas/${vendaDaMaria.id}/itens`, { metodo: "POST", cookie: lucas, corpo: await item(lucas) });
    expect(doMaster.dados.erro).toBe("Só quem registrou a venda pode acrescentar itens.");
  });

  it("o vendedor acrescenta itens e o total sobe", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const [venda] = await consultar<{ id: string; valor_total_centavos: number }>(
      "select id, valor_total_centavos from vendas where vendedor_id = ? limit 1",
      await perfilId("joao@apiarioribeiro.dev"),
    );
    const { produtos } = await pontoEProdutos(joao);

    const acrescimo = await chamar(`/api/e/apiario-ribeiro/vendas/${venda.id}/itens`, {
      metodo: "POST",
      cookie: joao,
      corpo: { itens: [{ produtoId: produtos[0], quantidade: 3, precoUnitario: 5 }] },
    });
    expect(acrescimo.dados.sucesso).toBe("Item acrescentado à venda.");
    const [depois] = await consultar<{ valor_total_centavos: number }>("select valor_total_centavos from vendas where id = ?", venda.id);
    expect(depois.valor_total_centavos).toBe(venda.valor_total_centavos + 1500);
  });
});

describe("mapa e cidades", () => {
  it("o pop-up do ponto traz 10 vendas por página", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const { dados: mapa } = await chamar("/api/e/apiario-ribeiro/mapa", { cookie: lucas });
    const ponto = mapa.pontos.find((p: { nome: string }) => p.nome === "Empório Bela Vista");
    expect(ponto.vendas).toBeGreaterThan(10);

    const pagina1 = await chamar(`/api/e/apiario-ribeiro/pontos/${ponto.id}/vendas?pagina=1`, { cookie: lucas });
    expect(pagina1.dados.vendas).toHaveLength(10);
    expect(pagina1.dados.total).toBe(ponto.vendas);
    const pagina2 = await chamar(`/api/e/apiario-ribeiro/pontos/${ponto.id}/vendas?pagina=2`, { cookie: lucas });
    expect(pagina2.dados.pagina).toBe(2);
    expect(pagina2.dados.vendas[0].id).not.toBe(pagina1.dados.vendas[0].id);
  });

  it("o revendedor vê no mapa só as cidades onde vendeu", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const { dados } = await chamar("/api/e/apiario-ribeiro/mapa", { cookie: joao });
    const [{ total }] = await consultar<{ total: number }>(
      "select count(*) total from vendas where vendedor_id = ?",
      await perfilId("joao@apiarioribeiro.dev"),
    );
    expect(dados.cidades.reduce((soma: number, c: { vendas: number }) => soma + c.vendas, 0)).toBe(total);
    expect(dados.pendentes).toBe(0); // só o master recebe a contagem de pendentes
  });
});
