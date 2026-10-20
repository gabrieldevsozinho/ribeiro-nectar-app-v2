// Apaga o banco D1 local (pasta .wrangler/state/v3/d1). Usado por `npm run db:reset`.
import { rmSync } from "node:fs";

rmSync(new URL("../.wrangler/state/v3/d1", import.meta.url), { recursive: true, force: true });
console.log("Banco local apagado.");
