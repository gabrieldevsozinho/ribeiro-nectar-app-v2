/**
 * Junta grafias diferentes da mesma cidade nos pontos de venda ("Santa Vitoria" × "Santa Vitória"):
 * todos os pontos da cidade ficam com a grafia mais completa. Desde a versão com o semáforo, o
 * sistema já faz isso ao cadastrar; este script arruma os pontos cadastrados antes.
 *
 * Uso (sem --gravar, só mostra o que mudaria):
 *   npx tsx scripts/unificar-cidades.ts --remote            (banco da nuvem)
 *   npx tsx scripts/unificar-cidades.ts --remote --gravar
 *   npx tsx scripts/unificar-cidades.ts --local --gravar     (banco local)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chaveCidade, melhorGrafia } from "../src/compartilhado/cidades";

const destino = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
const gravar = process.argv.includes("--gravar");
if (!destino) throw new Error("Informe --remote (nuvem) ou --local.");

/** No Windows o npx só roda pelo shell: argumentos com espaço vão entre aspas. */
function wrangler(argumentos: string[]) {
  const args = ["wrangler", "d1", "execute", "DB", destino!, ...argumentos].map((a) => (a.includes(" ") ? `"${a}"` : a));
  return spawnSync("npx", args, { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
}

type Ponto = {
  id: string;
  nome: string;
  empresa: string;
  empresa_id: string;
  cidade: string;
  uf: string;
  logradouro: string;
  numero: string | null;
};

const consulta = wrangler([
  "--json",
  "--command",
  "select p.id, p.nome, p.empresa_id, e.nome as empresa, p.cidade, p.uf, p.logradouro, p.numero from pontos_venda p join empresas e on e.id = p.empresa_id",
]);
if (consulta.status !== 0) throw new Error(`O Wrangler não conseguiu ler os pontos:\n${consulta.stderr || consulta.stdout}`);
const saida = consulta.stdout.slice(consulta.stdout.indexOf("["));
const pontos = (JSON.parse(saida) as { results: Ponto[] }[])[0]!.results;

// lower() do SQLite só troca A-Z: a mesma regra do índice pontos_endereco_unico.
const minusculasSqlite = (texto: string) => texto.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
const chaveEndereco = (p: Ponto, cidade: string) =>
  [p.empresa_id, minusculasSqlite(p.logradouro), minusculasSqlite(p.numero ?? ""), minusculasSqlite(cidade), p.uf].join("\u0000");

const grupos = new Map<string, Ponto[]>();
for (const p of pontos) {
  const chave = `${p.empresa_id}|${chaveCidade(p.cidade, p.uf)}`;
  grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
}

const novaCidade = new Map<string, string>(); // id do ponto → grafia nova
const texto = (valor: string) => `'${valor.replaceAll("'", "''")}'`;
const comandos: string[] = [];

for (const lista of grupos.values()) {
  const usos = new Map<string, number>();
  lista.forEach((p) => usos.set(p.cidade, (usos.get(p.cidade) ?? 0) + 1));
  if (usos.size < 2) continue;

  const escolhida = melhorGrafia([...usos].map(([cidade, n]) => ({ cidade, usos: n })));
  const mudar = lista.filter((p) => p.cidade !== escolhida);
  const { empresa, uf } = lista[0]!;
  const outras = [...usos.keys()].filter((c) => c !== escolhida);

  // Dois cadastros do mesmo endereço, um em cada grafia: unificar quebraria o "um ponto por endereço".
  const ocupados = new Set(pontos.filter((p) => !mudar.includes(p)).map((p) => chaveEndereco(p, novaCidade.get(p.id) ?? p.cidade)));
  const repetido = mudar.find((p) => ocupados.has(chaveEndereco(p, escolhida)));
  if (repetido) {
    console.log(`⚠ ${empresa}: "${outras.join('", "')}" → "${escolhida}"/${uf} pulado: "${repetido.nome}" ficaria repetido. Junte os dois cadastros à mão.`);
    continue;
  }

  mudar.forEach((p) => novaCidade.set(p.id, escolhida));
  console.log(`${empresa}: "${outras.join('", "')}" → "${escolhida}"/${uf} (${mudar.length} ${mudar.length === 1 ? "ponto" : "pontos"})`);
  comandos.push(
    `UPDATE pontos_venda SET cidade = ${texto(escolhida)} WHERE empresa_id = ${texto(lista[0]!.empresa_id)} AND uf = ${texto(uf)} AND cidade IN (${outras.map(texto).join(", ")});`,
  );
}

if (comandos.length === 0) {
  console.log("Nenhuma cidade com grafias diferentes. Nada a fazer.");
} else if (!gravar) {
  console.log("\nNada foi gravado. Rode de novo com --gravar para aplicar.");
} else {
  const pasta = mkdtempSync(path.join(tmpdir(), "ribeiro-cidades-"));
  const arquivo = path.join(pasta, "cidades.sql");
  try {
    writeFileSync(arquivo, comandos.join("\n"));
    const resultado = wrangler(["--file", arquivo, "--yes"]);
    if (resultado.status !== 0) throw new Error(`O Wrangler não conseguiu gravar:\n${resultado.stderr || resultado.stdout}`);
    console.log(`\nPronto: ${comandos.length} ${comandos.length === 1 ? "cidade unificada" : "cidades unificadas"}.`);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}
