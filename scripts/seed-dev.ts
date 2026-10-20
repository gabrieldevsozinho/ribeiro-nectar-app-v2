/**
 * Dados de demonstração no banco LOCAL (o mesmo que o `npm run dev` usa).
 *
 * Uso:  npm run db:seed        (depois de `npm run db:reset`)
 *
 * Usuários e senha de teste: veja src/worker/seed/demo.ts.
 * Só roda no D1 local: o getPlatformProxy não conecta no banco da nuvem.
 */
import { getPlatformProxy } from "wrangler";
import { criarDb } from "../src/worker/db/cliente";
import { criarDadosDemo } from "../src/worker/seed/demo";

const { env, dispose } = await getPlatformProxy<Env>();
try {
  const resultado = await criarDadosDemo(criarDb(env.DB));
  if (resultado === "ja-existe") {
    console.log("Os dados de demonstração já existem. Rode `npm run db:reset` para recomeçar do zero.");
  } else {
    console.log("Dados de demonstração criados.");
    console.log("Empresas: /apiario-ribeiro e /mel-silva · Admin: /admin/login");
    console.log("Usuários e senha de teste: veja src/worker/seed/demo.ts");
  }
} finally {
  await dispose();
}
