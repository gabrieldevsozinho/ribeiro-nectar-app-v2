import { expect, test } from "@playwright/test";
import { entrarComo } from "./apoio";

test("no celular, o menu abre como gaveta e a página não rola para os lados", async ({ page }) => {
  await entrarComo(page, "joao@apiarioribeiro.dev");

  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Mapa e cidades" }).click();
  await expect(page).toHaveURL(/\/mapa$/);
  await expect(menu).toBeHidden();

  for (const caminho of ["/apiario-ribeiro/vendas", "/apiario-ribeiro/vendas/nova", "/apiario-ribeiro/mapa", "/apiario-ribeiro/pontos"]) {
    await page.goto(caminho);
    await page.waitForLoadState("networkidle");
    const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(larguras[0], `rolagem lateral em ${caminho}`).toBeLessThanOrEqual(larguras[1]);
  }
});
