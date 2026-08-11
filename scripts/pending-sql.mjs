/**
 * Prépare le SQL restant à coller dans l'éditeur Supabase.
 *
 *   npm run db:sql            # toutes les migrations « de rattrapage »
 *   npm run db:sql -- 06 07   # celles-là seulement
 *
 * Certaines opérations sont du DDL : ni PostgREST ni la clé secrète ne
 * peuvent les exécuter. Il faut passer par l'éditeur SQL du tableau de bord.
 * Ce script réunit les fichiers concernés dans le bon ordre et les met dans
 * le presse-papiers, pour n'avoir qu'un seul collage à faire.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");

const C = { reset: "[0m", bold: "[1m", dim: "[2m", green: "[32m", cyan: "[36m" };

// Par défaut, les deux correctifs qui n'ont jamais pu passer par le CLI.
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["000800"];

const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .filter((name) => wanted.some((token) => name.includes(token)))
  .sort();

if (files.length === 0) {
  console.error(`Aucune migration ne correspond à : ${wanted.join(", ")}`);
  process.exit(1);
}

const sql = files
  .map((name) => `-- ▼ ${name}\n\n${readFileSync(join(dir, name), "utf8").trimEnd()}\n`)
  .join("\n\n");

/* ─── Presse-papiers ─────────────────────────────────────────────────── */

const COPY = {
  win32: ["clip", []],
  darwin: ["pbcopy", []],
  linux: ["xclip", ["-selection", "clipboard"]],
}[process.platform];

let copied = false;

if (COPY) {
  const [command, args] = COPY;
  // `clip` lit stdin en UTF-16LE ; ailleurs, UTF-8 convient.
  const input = process.platform === "win32" ? Buffer.from(sql, "utf16le") : sql;
  copied = spawnSync(command, args, { input }).status === 0;
}

console.log(`\n${C.bold}À coller dans l'éditeur SQL de Supabase${C.reset}`);
for (const name of files) console.log(`  ${C.dim}·${C.reset} ${name}`);

if (copied) {
  console.log(`\n${C.green}✓${C.reset} Copié dans le presse-papiers (${sql.split("\n").length} lignes).`);
  console.log(`  Ouvrez ${C.cyan}Supabase → SQL Editor → New query${C.reset}, collez, exécutez.`);
  console.log(`  Puis : ${C.cyan}npm run db:check${C.reset}\n`);
} else {
  console.log(`\n${C.dim}— presse-papiers indisponible, le SQL suit —${C.reset}\n`);
  console.log(sql);
}
