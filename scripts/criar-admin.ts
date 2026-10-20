/**
 * Cria o administrador da plataforma (Gabriel Studio). Use uma vez, ao publicar.
 *
 * Uso (PowerShell):
 *   $env:ADMIN_NOME="Gabriel"; $env:ADMIN_EMAIL="voce@exemplo.com"; $env:ADMIN_SENHA="..."
 *   npx tsx scripts/criar-admin.ts --remote      (banco da nuvem)
 *   npx tsx scripts/criar-admin.ts --local       (banco local)
 *
 * A senha não fica salva em lugar nenhum: só o hash vai para o banco, por um arquivo temporário.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gerarHashSenha } from "../src/worker/auth/senha-hash";

const destino = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
const nome = process.env.ADMIN_NOME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const senha = process.env.ADMIN_SENHA;

if (!destino) throw new Error("Informe --remote (nuvem) ou --local.");
if (!nome || !email || !senha) throw new Error("Defina ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA.");
if (senha.length < 12 || !/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
  throw new Error("Use uma senha forte para o admin: pelo menos 12 caracteres, com letras e números.");
}

const texto = (valor: string) => `'${valor.replaceAll("'", "''")}'`;
const userId = crypto.randomUUID();
const agora = Date.now();
const sql = `
INSERT INTO auth_usuarios (id, name, email, email_verified, created_at, updated_at)
  VALUES (${texto(userId)}, ${texto(nome)}, ${texto(email)}, 1, ${agora}, ${agora});
INSERT INTO auth_contas (id, account_id, provider_id, user_id, password, created_at, updated_at)
  VALUES (${texto(crypto.randomUUID())}, ${texto(userId)}, 'credential', ${texto(userId)}, ${texto(await gerarHashSenha(senha))}, ${agora}, ${agora});
INSERT INTO perfis (id, user_id, empresa_id, papel, nome, email, deve_trocar_senha)
  VALUES (${texto(crypto.randomUUID())}, ${texto(userId)}, NULL, 'admin_plataforma', ${texto(nome)}, ${texto(email)}, 0);
`;

const pasta = mkdtempSync(path.join(tmpdir(), "ribeiro-admin-"));
const arquivo = path.join(pasta, "admin.sql");
try {
  writeFileSync(arquivo, sql);
  const resultado = spawnSync("npx", ["wrangler", "d1", "execute", "DB", destino, "--file", arquivo, "--yes"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (resultado.status !== 0) throw new Error("O Wrangler não conseguiu gravar o admin (veja a mensagem acima).");
  console.log(`Administrador da plataforma criado: ${email}. Entre em /admin/login.`);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
