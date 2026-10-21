import { describe, expect, it } from "vitest";
import { chaveCidade, melhorGrafia } from "../src/compartilhado/cidades";
import { diasDesde, faixasDosPrazos, piorSituacao, situacaoPelosDias } from "../src/compartilhado/semaforo";
import { chamar, consultar, entrar } from "./apoio";

const BASE = "/api/e/apiario-ribeiro";

describe("semáforo de visitas", () => {
  it("classifica pelos dias desde a última venda (exemplo: até 30 em dia, até 60 atenção)", () => {
    const prazos = { emDia: 30, atencao: 60 };
    expect(situacaoPelosDias(0, prazos)).toBe("em_dia");
    expect(situacaoPelosDias(30, prazos)).toBe("em_dia");
    expect(situacaoPelosDias(31, prazos)).toBe("atencao");
    expect(situacaoPelosDias(60, prazos)).toBe("atencao");
    expect(situacaoPelosDias(61, prazos)).toBe("atrasado");
    expect(faixasDosPrazos(prazos)).toEqual({ em_dia: "até 30 dias", atencao: "de 31 a 60 dias", atrasado: "mais de 60 dias" });
    expect(piorSituacao(["em_dia", null, "atencao"])).toBe("atencao");
  });

  it("conta dias de calendário no fuso de Brasília", () => {
    const agora = new Date("2026-10-21T10:00:00-03:00");
    expect(diasDesde("2026-10-21T08:00:00-03:00", agora)).toBe(0);
    // Ontem às 23h (Brasília) já é 1 dia, mesmo com menos de 24 horas.
    expect(diasDesde("2026-10-20T23:00:00-03:00", agora)).toBe(1);
    expect(diasDesde("2026-09-21T12:00:00-03:00", agora)).toBe(30);
  });

  it("o master define os prazos; o revendedor vê, mas não altera", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const joao = await entrar("joao@apiarioribeiro.dev");

    const invalido = await chamar(`${BASE}/mapa/prazos`, { metodo: "PUT", cookie: lucas, corpo: { emDia: "30", atencao: "30" } });
    expect(invalido.status).toBe(422);
    expect(invalido.dados.erro).toBe("O prazo de atenção precisa ser maior que o prazo em dia.");

    const negado = await chamar(`${BASE}/mapa/prazos`, { metodo: "PUT", cookie: joao, corpo: { emDia: "30", atencao: "60" } });
    expect(negado.status).toBe(403);

    const salvo = await chamar(`${BASE}/mapa/prazos`, { metodo: "PUT", cookie: lucas, corpo: { emDia: "30", atencao: "60" } });
    expect(salvo.status).toBe(200);
    expect((await chamar(`${BASE}/mapa`, { cookie: joao })).dados.prazos).toEqual({ emDia: 30, atencao: 60 });

    // Os prazos são da empresa: a outra empresa continua sem.
    const bia = await entrar("bia@melsilva.dev", "mel-silva");
    expect((await chamar("/api/e/mel-silva/mapa", { cookie: bia })).dados.prazos).toBeNull();
  });
});

describe("cidade escrita de jeitos diferentes", () => {
  it("compara sem acento nem maiúsculas e fica com a grafia mais completa", () => {
    expect(chaveCidade(" Santa  Vitória ", "mg")).toBe(chaveCidade("santa vitoria", "MG"));
    expect(melhorGrafia([{ cidade: "Santa Vitoria", usos: 5 }, { cidade: "Santa Vitória", usos: 1 }])).toBe("Santa Vitória");
    expect(melhorGrafia([{ cidade: "SANTA VITÓRIA", usos: 1 }, { cidade: "Santa Vitória", usos: 1 }])).toBe("Santa Vitória");
  });

  it("o ponto novo usa a grafia já cadastrada, e a grafia mais completa corrige as outras", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const ponto = (nome: string, cidade: string) => ({
      nome,
      cnpj: "",
      contato: "",
      telefone: "",
      logradouro: `Rua ${nome}`,
      numero: "1",
      bairro: "",
      cidade,
      uf: "SP",
      cep: "",
      latitude: null,
      longitude: null,
      localizacaoStatus: "pendente",
    });

    // "ribeirao preto" vira o "Ribeirão Preto" que a empresa já usa.
    const novo = await chamar(`${BASE}/pontos`, { metodo: "POST", cookie: lucas, corpo: ponto("Grafia 1", "ribeirao preto") });
    expect(novo.status).toBe(200);
    const [salvo] = await consultar<{ cidade: string }>("select cidade from pontos_venda where id = ?", novo.dados.id);
    expect(salvo.cidade).toBe("Ribeirão Preto");

    // Cidade nova sem acento; depois alguém escreve com acento: todos ficam com acento.
    await chamar(`${BASE}/pontos`, { metodo: "POST", cookie: lucas, corpo: ponto("Grafia 2", "Sao Carlos") });
    await chamar(`${BASE}/pontos`, { metodo: "POST", cookie: lucas, corpo: ponto("Grafia 3", "São  Carlos") });
    const grafias = await consultar<{ cidade: string }>("select distinct cidade from pontos_venda where nome like 'Grafia%' and uf = 'SP'");
    expect(grafias.map((g) => g.cidade).sort()).toEqual(["Ribeirão Preto", "São Carlos"]);

    const cidades = await chamar(`${BASE}/pontos/cidades`, { cookie: lucas });
    expect(cidades.dados).toContainEqual({ cidade: "São Carlos", uf: "SP" });
  });

  it("o filtro de vendas por cidade acha todas as grafias", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const deFranca = () => chamar(`${BASE}/vendas?cidade=${encodeURIComponent("Franca|SP")}`, { cookie: lucas });
    const antes = (await deFranca()).dados.total;
    expect(antes).toBeGreaterThan(0);
    // Uma grafia antiga, de antes da unificação automática.
    await consultar("update pontos_venda set cidade = 'FRANCA' where nome = 'Padaria Pão de Mel'");
    expect((await deFranca()).dados.total).toBe(antes);
    const { dados } = await chamar(`${BASE}/vendas/filtros`, { cookie: lucas });
    expect(dados.cidades.filter((c: { uf: string; cidade: string }) => chaveCidade(c.cidade, c.uf) === "franca|SP")).toHaveLength(1);
  });
});

describe("pontos sem localização", () => {
  it("o não encontrado sai da busca automática até o endereço mudar", async () => {
    const lucas = await entrar("lucas@apiarioribeiro.dev");
    const pendentes = await chamar(`${BASE}/pontos/pendentes`, { cookie: lucas });
    const sitio = pendentes.dados.find((p: { nome: string }) => p.nome.startsWith("Sítio Boa Esperança"));
    expect(sitio).toBeTruthy();

    expect((await chamar(`${BASE}/pontos/${sitio.id}/localizacao/nao-encontrada`, { metodo: "POST", cookie: lucas })).status).toBe(200);
    const depois = await chamar(`${BASE}/pontos/pendentes`, { cookie: lucas });
    expect(depois.dados.some((p: { id: string }) => p.id === sitio.id)).toBe(false);
    const todos = await chamar(`${BASE}/pontos/pendentes?todos=1`, { cookie: lucas });
    expect(todos.dados.some((p: { id: string }) => p.id === sitio.id)).toBe(true);

    const { dados: mapa } = await chamar(`${BASE}/mapa`, { cookie: lucas });
    expect(mapa.pendentes.naoEncontrados.map((p: { id: string }) => p.id)).toContain(sitio.id);

    // Ao corrigir o endereço, volta para a busca automática.
    const { dados: atual } = await chamar(`${BASE}/pontos/${sitio.id}`, { cookie: lucas });
    const { id: _id, podeEditar: _pode, ...dadosPonto } = atual;
    const alterado = await chamar(`${BASE}/pontos/${sitio.id}`, {
      metodo: "PUT",
      cookie: lucas,
      corpo: { ...dadosPonto, cnpj: "", contato: "", telefone: "", cep: "", numero: "km 5", bairro: dadosPonto.bairro ?? "" },
    });
    expect(alterado.status).toBe(200);
    const deNovo = await chamar(`${BASE}/pontos/pendentes`, { cookie: lucas });
    expect(deNovo.dados.some((p: { id: string }) => p.id === sitio.id)).toBe(true);
  });

  it("o revendedor não marca ponto como não encontrado", async () => {
    const joao = await entrar("joao@apiarioribeiro.dev");
    const [ponto] = await consultar<{ id: string }>("select id from pontos_venda where localizacao_status = 'pendente' limit 1");
    expect((await chamar(`${BASE}/pontos/${ponto.id}/localizacao/nao-encontrada`, { metodo: "POST", cookie: joao })).status).toBe(403);
  });
});
