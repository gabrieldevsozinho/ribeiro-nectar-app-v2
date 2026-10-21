/**
 * Fluxos principais da Fase 1, no navegador.
 * Rode com o banco recém-criado: `npm run db:reset && npm run db:seed && npm run test:e2e`.
 */
import { expect, test } from "@playwright/test";
import { entrar, entrarComo } from "./apoio";

test("usuário de outra empresa é recusado no login", async ({ page }) => {
  await entrar(page, "apiario-ribeiro", "marcos@melsilva.dev");
  await expect(page.getByText("Este usuário não pertence a esta empresa.")).toBeVisible();
  await expect(page).toHaveURL(/\/apiario-ribeiro\/login/);
});

test("primeiro acesso obriga a trocar a senha temporária", async ({ page }) => {
  await entrar(page, "apiario-ribeiro", "novo@apiarioribeiro.dev");
  await expect(page).toHaveURL(/primeiro-acesso/);

  // Tentar ir direto para as vendas volta para a troca de senha.
  await page.goto("/apiario-ribeiro/vendas");
  await expect(page).toHaveURL(/primeiro-acesso/);

  await page.getByLabel("Nova senha", { exact: true }).fill("Favo-e2e-2026");
  await page.getByLabel("Repita a nova senha").fill("Favo-e2e-2026");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/apiario-ribeiro\/vendas$/);
  await expect(page.getByRole("heading", { name: "Minhas vendas" })).toBeVisible();
});

test("revendedor registra uma venda e acrescenta um item", async ({ page }) => {
  await entrarComo(page, "joao@apiarioribeiro.dev");
  await page.getByRole("link", { name: "Nova venda" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova venda" })).toBeVisible();

  await page.getByRole("button", { name: /Empório Bela Vista/ }).click();
  await page.getByLabel("Produto").selectOption({ label: "Mel silvestre · pote 1 kg" });
  await page.getByLabel("Quantidade").fill("3");
  await page.getByRole("button", { name: "Adicionar à venda" }).click();
  await expect(page.getByText("R$ 135,00").first()).toBeVisible();

  await page.getByRole("button", { name: /Registrar venda · R\$\s?135,00/ }).click();
  await expect(page.getByText("Venda registrada")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Venda de R\$\s?135,00/ })).toBeVisible();

  // Acrescenta um item na própria venda.
  await page.getByLabel("Produto").filter({ visible: true }).selectOption({ label: "Favo de mel · bandeja 300 g" });
  await page.getByLabel("Quantidade").filter({ visible: true }).fill("1");
  await page.getByRole("button", { name: "Adicionar à venda" }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Confirmar acréscimo" }).click();
  await expect(page.getByText("Item acrescentado à venda.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Venda de R\$\s?165,00/ })).toBeVisible();

  // Ao voltar para "Nova venda", o formulário está limpo (sem os itens da venda anterior).
  await page.getByRole("link", { name: "Nova venda" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova venda" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Registrar venda$/ })).toBeVisible();
  await expect(page.getByText("Onde você vendeu por último")).toBeVisible();
});

test("master bloqueia um revendedor e ele não consegue mais entrar", async ({ page }) => {
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/revendedores");
  await page.getByRole("link", { name: /Pedro Alves/ }).click();

  page.once("dialog", (dialogo) => dialogo.accept());
  await page.getByRole("button", { name: "Bloquear acesso" }).click();
  await expect(page.getByText("Pedro Alves foi bloqueado.")).toBeVisible();

  await entrar(page, "apiario-ribeiro", "pedro@apiarioribeiro.dev");
  await expect(page.getByText(/acesso está bloqueado/)).toBeVisible();

  // Desbloqueia para não afetar outros testes.
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/revendedores");
  await page.getByRole("link", { name: /Pedro Alves/ }).click();
  await page.getByRole("button", { name: "Desbloquear acesso" }).click();
  await expect(page.getByText("Pedro Alves foi desbloqueado.")).toBeVisible();
});

test("menu de cidades abre o pop-up com as vendas paginadas", async ({ page }) => {
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/mapa");
  await page.getByRole("button", { name: /Ribeirão Preto\/SP/ }).click();
  // No menu de cidades (o marcador do mapa tem o mesmo nome).
  await page.getByLabel("Cidades onde houve vendas").getByRole("button", { name: /Empório Bela Vista/ }).click();

  const popup = page.getByRole("dialog");
  await expect(popup.getByRole("heading", { name: "Empório Bela Vista" })).toBeVisible();
  await expect(popup.getByText(/Página 1 de \d+/)).toBeVisible();
  // As 10 vendas da página (o "Registrar venda aqui" leva a /vendas/nova).
  await expect(popup.locator('a[href*="/vendas/"]:not([href*="/vendas/nova"])')).toHaveCount(10);
  await expect(popup.getByRole("link", { name: "Registrar venda aqui" })).toHaveAttribute("href", /\/vendas\/nova\?ponto=/);

  await popup.getByRole("button", { name: /Próxima/ }).click();
  await expect(popup.getByText(/Página 2 de \d+/)).toBeVisible();
});

test("revendedor não acessa a área do master", async ({ page }) => {
  await entrarComo(page, "maria@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/revendedores");
  await expect(page).toHaveURL(/\/apiario-ribeiro\/vendas$/);
  await expect(page.getByRole("link", { name: "Revendedores" })).toHaveCount(0);
});
