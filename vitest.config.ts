import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * Testes da API rodando dentro do runtime do Workers (Miniflare), com um D1 só de teste:
 * as migrações e os dados de demonstração são aplicados em tests/preparar.ts.
 */
export default defineConfig(async () => {
  const migracoes = await readD1Migrations(path.join(import.meta.dirname, "drizzle/migracoes"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migracoes,
            AMBIENTE: "desenvolvimento",
            BETTER_AUTH_URL: "https://ribeironectar.test",
            BETTER_AUTH_SECRET: "segredo-so-para-os-testes-automaticos-0123456789",
            MAPA_PROVEDOR: "google",
            GOOGLE_MAPS_CHAVE_DEV: "",
            RESEND_API_KEY: "",
          },
        },
      }),
    ],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    test: {
      include: ["tests/**/*.test.ts"],
      setupFiles: ["./tests/preparar.ts"],
      testTimeout: 30_000,
    },
  };
});
