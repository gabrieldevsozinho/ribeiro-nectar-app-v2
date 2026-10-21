/**
 * Mapa com OpenStreetMap + Nominatim (MAPA_PROVEDOR=osm no .env.local).
 * Usa a internet de verdade: carrega os mapas do OSM e consulta o Nominatim.
 */
import { expect, test } from "@playwright/test";
import { entrarComo } from "./apoio";

test("mapa de vendas mostra marcadores e abre o pop-up pelo marcador", async ({ page }) => {
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/mapa");
  await expect(page.locator(".leaflet-container").filter({ visible: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });

  // Batatais tem um ponto no mapa (o outro está pendente): um marcador isolado.
  await page.getByRole("button", { name: /Batatais\/SP/ }).click();
  const marcador = page.locator('[title="Armazém Batatais"]').filter({ visible: true });
  await expect(marcador).toBeVisible({ timeout: 15_000 });
  await marcador.click();

  const popup = page.getByRole("dialog");
  await expect(popup.getByRole("heading", { name: "Armazém Batatais" })).toBeVisible();
  await expect(popup.getByText(/Página 1 de/)).toBeVisible();
});

test("o master define os prazos e o “Estou aqui” abre a cidade onde ele está", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -20.5372, longitude: -47.4015 }); // centro de Franca/SP
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/mapa");

  await page.getByRole("button", { name: /Definir prazos|Alterar prazos/ }).first().click();
  const janela = page.getByRole("dialog", { name: "Prazos de visita" });
  await janela.getByLabel("Em dia até").fill("30");
  await janela.getByLabel("Atenção até").fill("60");
  await expect(janela.getByText("de 31 a 60 dias desde a última venda")).toBeVisible();
  await janela.getByRole("button", { name: "Salvar prazos" }).click();
  await expect(janela).toBeHidden();
  await expect(page.getByLabel("Legenda das cores")).toContainText("Em dia até 30 dias");

  await page.getByRole("button", { name: "Estou aqui" }).click();
  await expect(page.getByRole("heading", { name: "Franca/SP" })).toBeVisible();
  // Na cidade: filtros pela situação, e o mapa só com os comércios dela.
  await expect(page.getByRole("group", { name: "Filtrar por situação" }).getByRole("button", { name: /Todos 2/ })).toBeVisible();
  await expect(page.locator(".pino-osm").filter({ visible: true })).toHaveCount(2, { timeout: 15_000 });
});

test("cadastro de ponto localiza o endereço pelo Nominatim e permite ajustar o pino", async ({ page }) => {
  test.setTimeout(90_000);
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/pontos/novo");

  await page.getByLabel("Nome do comércio").fill("Loja da Paulista (teste OSM)");
  await page.getByLabel("Rua / avenida").fill("Avenida Paulista");
  await page.getByLabel("Número").fill("1578");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").selectOption("SP");

  await page.getByRole("button", { name: "Localizar no mapa" }).click();
  await expect(page.locator(".pino-osm").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Arraste o pino ou toque no mapa para ajustar.")).toBeVisible();

  await page.getByRole("button", { name: "Cadastrar ponto" }).click();
  await expect(page).toHaveURL(/\/apiario-ribeiro\/pontos\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Pelo endereço")).toBeVisible();
  await expect(page.locator(".leaflet-container").filter({ visible: true })).toBeVisible({ timeout: 20_000 });
});

test("a página da venda mostra o mapa e o resumo da venda ao tocar no marcador", async ({ page }) => {
  await entrarComo(page, "lucas@apiarioribeiro.dev");
  await page.goto("/apiario-ribeiro/vendas?cidade=Ribeir%C3%A3o%20Preto%7CSP");
  await page.locator('main a[href*="/vendas/"]:not([href$="/nova"])').filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Onde foi a venda" })).toBeVisible();

  const marcador = page.locator(".pino-osm").filter({ visible: true });
  await expect(marcador).toBeVisible({ timeout: 20_000 });
  await marcador.click();
  const balao = page.locator(".leaflet-popup-content").filter({ visible: true });
  await expect(balao).toContainText("Total:");
  await expect(balao).toContainText("Quem vendeu:");
});
