/**
 * Exécute pour de vrai toutes les requêtes PostgREST écrites dans `src`.
 *
 *   npm run db:smoke
 *
 * Pourquoi ce script existe : `supabase-js` ne lève jamais. Une requête
 * refusée renvoie `{ data: null, error }`, et le code appelant lit ce `null`
 * comme « aucun résultat ». Une page se rend vide, un `if (!shop)` redirige
 * vers l'accueil — sans la moindre trace dans la console. Deux pannes de ce
 * type ont déjà échappé au typecheck comme au build, qui ne parlent jamais
 * à la base :
 *
 *   · `shops → categories` était ambigu (clé étrangère *et* table de
 *     liaison `shop_categories`) : HTTP 300, PGRST201.
 *   · une policy RLS trop stricte rend une table illisible : HTTP 401.
 *
 * Fonctionnement : on relève chaque couple `.from("table").select("…")` du
 * code, on crée deux comptes jetables — un vendeur avec boutique, un client —
 * et on rejoue chaque requête avec leur jeton. Les comptes sont supprimés à
 * la fin, y compris en cas d'échec.
 *
 * Les `select()` construits dynamiquement sont ignorés : ils sont hors de
 * portée d'une analyse statique, et le script le dit.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

const C = {
  reset: "[0m", bold: "[1m", dim: "[2m",
  red: "[31m", green: "[32m", yellow: "[33m", cyan: "[36m",
};

const die = (message, hint) => {
  console.error(`${C.red}✗ ${message}${C.reset}`);
  if (hint) console.error(`  ${C.dim}${hint}${C.reset}`);
  process.exit(1);
};

/* ─── Environnement ──────────────────────────────────────────────────── */

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) die(".env.local introuvable");

const env = {};
for (const line of readFileSync(envPath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || url.includes("placeholder")) die("NEXT_PUBLIC_SUPABASE_URL non configurée");
if (!anon) die("NEXT_PUBLIC_SUPABASE_ANON_KEY non configurée");
if (!secret || secret.includes("placeholder") || secret.includes("publishable")) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY requise",
    "Le script crée puis supprime deux comptes jetables.",
  );
}

const svc = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

/* ─── Relevé des requêtes dans le code ───────────────────────────────── */

function walk(dir, visit) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path, entry);
  }
}

// `.from("table")` puis, un peu plus loin, `.select(<littéral>)`. La fenêtre
// couvre les appels étalés sur plusieurs lignes.
const FROM_SELECT = /\.from\(\s*"([a-z_]+)"\s*\)([\s\S]{0,700}?)\.select\(\s*(["`])([\s\S]*?)\3/g;

/**
 * Reproduit le nettoyage que `supabase-js` applique avant l'envoi : tout
 * blanc hors guillemets est supprimé. Sans cela, un `select()` indenté sur
 * plusieurs lignes serait rejeté ici alors qu'il fonctionne en production.
 */
function cleanColumns(columns) {
  let quoted = false;
  return columns
    .split("")
    .map((character) => {
      if (/\s/.test(character) && !quoted) return "";
      if (character === '"') quoted = !quoted;
      return character;
    })
    .join("");
}

const queries = new Map(); // "table|select" -> { table, select, sites:Set }
let dynamic = 0;

walk(srcDir, (path, name) => {
  if (!name.endsWith(".ts") && !name.endsWith(".tsx")) return;

  const source = readFileSync(path, "utf8");
  const file = relative(root, path).replace(/\\/g, "/");

  for (const match of source.matchAll(FROM_SELECT)) {
    const [, table, between, , columns] = match;

    // Un `.from()` suivi d'un `.insert()`/`.update()` avant le `.select()`
    // décrit ce qui est renvoyé après écriture : rien à sonder en lecture.
    if (/\.(insert|update|upsert|delete|rpc)\(/.test(between)) continue;

    if (columns.includes("${")) {
      dynamic += 1;
      continue;
    }

    const select = cleanColumns(columns);
    const key = `${table}|${select}`;

    if (!queries.has(key)) queries.set(key, { table, select, sites: new Set() });
    queries.get(key).sites.add(file);
  }
});

console.log(`\n${C.bold}Requêtes relevées${C.reset} : ${queries.size}`);
if (dynamic > 0) {
  console.log(`${C.dim}${dynamic} select() construit(s) dynamiquement — non sondable(s).${C.reset}`);
}

/* ─── Comptes jetables ───────────────────────────────────────────────── */

const stamp = Date.now();
const accounts = [
  {
    label: "vendeur",
    email: `smoke-vendeur-${stamp}@mall-express.test`,
    password: `Smoke-${stamp}-V!`,
    metadata: {
      role: "vendor",
      first_name: "Smoke",
      last_name: "Vendeur",
      shop_name: `Boutique Smoke ${stamp}`,
      shop_location: "Gafsa",
    },
  },
  {
    label: "client",
    email: `smoke-client-${stamp}@mall-express.test`,
    password: `Smoke-${stamp}-C!`,
    metadata: { role: "client", first_name: "Smoke", last_name: "Client" },
  },
];

async function createAccount(account) {
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: account.metadata,
    }),
  });

  const body = await created.json();
  if (!created.ok || !body.id) {
    die(`Création du compte ${account.label} impossible (HTTP ${created.status})`,
        JSON.stringify(body).slice(0, 300));
  }
  account.id = body.id;

  const session = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });

  const token = await session.json();
  if (!token.access_token) {
    die(`Connexion du compte ${account.label} impossible`, JSON.stringify(token).slice(0, 300));
  }
  account.headers = { apikey: anon, Authorization: `Bearer ${token.access_token}` };
}

async function deleteAccount(account) {
  if (!account.id) return;
  await fetch(`${url}/auth/v1/admin/users/${account.id}`, { method: "DELETE", headers: svc });
}

/* ─── Exécution ──────────────────────────────────────────────────────── */

let failures = [];

try {
  for (const account of accounts) await createAccount(account);
  console.log(`${C.dim}Comptes jetables créés : vendeur + client.${C.reset}\n`);

  for (const { table, select, sites } of queries.values()) {
    // On sonde avec le vendeur : c'est le rôle qui voit le plus de tables.
    // Une requête refusée aux deux rôles est un vrai défaut.
    const path = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`;

    let best = null;
    for (const account of accounts) {
      const response = await fetch(path, { headers: account.headers });
      if (response.ok) { best = null; break; }
      best = { status: response.status, body: (await response.text()).slice(0, 300) };
    }

    if (best) {
      failures.push({ table, select, sites: [...sites], ...best });
      process.stdout.write(`${C.red}✗${C.reset}`);
    } else {
      process.stdout.write(`${C.green}·${C.reset}`);
    }
  }
  process.stdout.write("\n");
} finally {
  for (const account of accounts) await deleteAccount(account);
}

/* ─── Bilan ──────────────────────────────────────────────────────────── */

if (failures.length === 0) {
  console.log(`\n${C.green}✓ Les ${queries.size} requêtes répondent.${C.reset}\n`);
  process.exit(0);
}

console.log(`\n${C.red}${C.bold}${failures.length} requête(s) en échec :${C.reset}\n`);

for (const failure of failures) {
  console.log(`  ${C.bold}${failure.table}${C.reset} — HTTP ${C.red}${failure.status}${C.reset}`);
  console.log(`    select: ${C.cyan}${failure.select}${C.reset}`);
  for (const site of failure.sites) console.log(`    ${C.dim}${site}${C.reset}`);
  console.log(`    ${C.dim}${failure.body}${C.reset}\n`);
}

console.log(`${C.yellow}Rappel :${C.reset} supabase-js ne lève pas. Ces requêtes renvoient
  \`{ data: null }\` en production — pages vides, redirections inexpliquées.\n`);

process.exit(1);
