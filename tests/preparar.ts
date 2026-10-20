import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { criarDb } from "../src/worker/db/cliente";
import { criarDadosDemo } from "../src/worker/seed/demo";

// Pode rodar mais de uma vez: as migrações aplicadas e os dados já criados são pulados.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
await criarDadosDemo(criarDb(env.DB));
