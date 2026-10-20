declare namespace Cloudflare {
  interface Env {
    /** Migrações lidas em vitest.config.ts e aplicadas em tests/preparar.ts. */
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
