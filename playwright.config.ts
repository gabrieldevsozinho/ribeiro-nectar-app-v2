import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta contra o ambiente local (Vite + Worker + D1 local).
 * Pré-requisitos: dados de demonstração recém-criados (`npm run db:reset && npm run db:seed`).
 * Usa o Chrome instalado no computador.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: /celular\.spec\.ts/ },
    { name: "celular", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /celular\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
