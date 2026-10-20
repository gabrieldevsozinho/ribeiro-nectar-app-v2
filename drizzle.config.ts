import { defineConfig } from "drizzle-kit";

/**
 * Gera as migrações SQL a partir de src/worker/db/esquema.ts.
 * Quem aplica no D1 é o Wrangler (`npm run db:migrar`), lendo a mesma pasta.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/worker/db/esquema.ts",
  out: "./drizzle/migracoes",
});
