/**
 * Entrada no Mapa e cidades, tabela com a situação dos comércios e preço próprio na venda.
 * Rode com o banco recém-criado: `npm run db:reset && npm run db:seed && npm run test:e2e`.
 */
import { expect, test } from "@playwright/test";
import { entrarComo } from "./apoio";

test("ao entrar, o master cai no Mapa e cidades e vê a situação de cada comércio", async ({ page }) => {
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await expect(page.getByRole("heading", { name: "Mapa e cidades", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mapa e cidades" }).first()).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: /Definir prazos|Alterar prazos/ }).first().click();
  const janela = page.getByRole("dialog", { name: "Prazos de visita" });
  await janela.getByLabel("Em dia até").fill("30");
  await janela.getByLabel("Atenção até").fill("60");
  await janela.getByRole("button", { name: "Salvar prazos" }).click();
  await expect(janela).toBeHidden();

  const tabela = page.getByRole("region", { name: "Situação dos comércios" });
  await expect(tabela.getByText("Nos em dia, quanto falta para entrar em atenção.")).toBeVisible();

  // Nos em dia, a coluna Prazo mostra quanto falta para entrar em atenção.
  await tabela.getByRole("group", { name: "Filtrar a tabela por situação" }).getByRole("button", { name: /Em dia/ }).click();
  const primeira = tabela.getByRole("row").nth(1);
  await expect(primeira).toContainText(/Entra em atenção (amanhã|em \d+ dias)/);

  // Tocar no comércio abre as vendas dele.
  const nome = (await primeira.getByRole("button").textContent())!.trim();
  await primeira.getByRole("button").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: nome })).toBeVisible();
});

test("o revendedor cobra o próprio preço na venda", async ({ page }) => {
  await entrarComo(page, "joao@apiarioribeiro.dev");
  await page.getByRole("link", { name: "Nova venda" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova venda" })).toBeVisible();

  await page.getByRole("button", { name: /Empório Bela Vista/ }).click();
  await page.getByLabel("Produto").selectOption({ label: "Mel silvestre · pote 1 kg" });
  await expect(page.getByText(/Preço sugerido: R\$\s?45,00/)).toBeVisible();

  await page.getByLabel("Quantidade").fill("2");
  await page.getByLabel("Seu preço (R$)").fill("50,00");
  await expect(page.getByText("Você está cobrando outro valor.")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar à venda" }).click();
  await expect(page.getByText(/\(sugerido R\$\s?45,00\)/)).toBeVisible();

  await page.getByRole("button", { name: /Registrar venda · R\$\s?100,00/ }).click();
  await expect(page.getByText("Venda registrada")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Venda de R\$\s?100,00/ })).toBeVisible();
});
