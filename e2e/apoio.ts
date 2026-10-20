import { expect, type Page } from "@playwright/test";

// Mesma senha definida em src/worker/seed/demo.ts.
export const SENHA_DEV = "Mel-dev-2026";

export async function entrar(page: Page, empresa: string, email: string, senha = SENHA_DEV) {
  // Começa sem sessão (como sair do sistema).
  await page.context().clearCookies();
  await page.goto(`/${empresa}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function entrarComo(page: Page, email: string) {
  await entrar(page, "apiario-ribeiro", email);
  await expect(page).toHaveURL(/\/apiario-ribeiro\/vendas$/);
}
