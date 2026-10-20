/** A busca de endereço é em etapas, da mais precisa para a menos precisa (a parte de rede não é testada aqui). */
import { describe, expect, it } from "vitest";
import { expandirLogradouro, montarTentativas } from "../src/worker/servicos/nominatim";

const base = { bairro: "Morumbi", cep: "38.320-000" };

describe("expandirLogradouro", () => {
  it("expande as abreviações do começo do endereço", () => {
    expect(expandirLogradouro("Av. Padre Francisco Breyner")).toBe("Avenida Padre Francisco Breyner");
    expect(expandirLogradouro("av Brasil")).toBe("Avenida Brasil");
    expect(expandirLogradouro("R. Tiradentes")).toBe("Rua Tiradentes");
    expect(expandirLogradouro("Rod. BR-050")).toBe("Rodovia BR-050");
    expect(expandirLogradouro("Pça. da Matriz")).toBe("Praça da Matriz");
  });

  it("não mexe no que já está por extenso nem em nomes que contêm a sigla", () => {
    expect(expandirLogradouro("Avenida Paulista")).toBe("Avenida Paulista");
    expect(expandirLogradouro("Rua Almirante Barroso")).toBe("Rua Almirante Barroso");
    expect(expandirLogradouro("  Rua   das   Flores ")).toBe("Rua das Flores");
  });
});

describe("montarTentativas", () => {
  const endereco = { ...base, logradouro: "Av. Padre Francisco Breyner", numero: "1913", cidade: "Santa Vitória", uf: "MG" };

  it("tenta rua e número, depois só a rua, depois a cidade — sem bairro nem CEP, que atrapalham a busca", () => {
    expect(montarTentativas(endereco)).toEqual([
      { precisao: "exata", parametros: { street: "1913 Avenida Padre Francisco Breyner", city: "Santa Vitória", state: "Minas Gerais" } },
      { precisao: "rua", parametros: { street: "Avenida Padre Francisco Breyner", city: "Santa Vitória", state: "Minas Gerais" } },
      { precisao: "cidade", parametros: { city: "Santa Vitória", state: "Minas Gerais" } },
    ]);
  });

  it("sem número, pula a busca exata", () => {
    const etapas = montarTentativas({ ...endereco, numero: " " }).map((t) => t.precisao);
    expect(etapas).toEqual(["rua", "cidade"]);
  });

  it("sem rua, só procura a cidade", () => {
    expect(montarTentativas({ ...endereco, logradouro: "", numero: "" }).map((t) => t.precisao)).toEqual(["cidade"]);
  });
});
