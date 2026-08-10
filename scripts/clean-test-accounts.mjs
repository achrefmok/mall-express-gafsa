/**
 * Supprime les comptes jetables laissés par les scripts de vérification.
 *
 *   npm run db:clean-tests
 *
 * `db:smoke` et les contrôles de mise en page créent des comptes en
 * `@mall-express.test`, puis les suppriment. Le nettoyage peut échouer : une
 * commande passée pendant le test retient le profil de l'acheteur, et la
 * suppression en cascade depuis `auth.users` s'arrête là. Le compte reste,
 * avec sa boutique et ses produits, au milieu des vraies données.
 *
 * Ce script fait le ménage dans l'ordre imposé par les clés étrangères.
 *
 * Le domaine `.test` est réservé (RFC 2606) et Supabase le refuse à
 * l'inscription publique : aucun compte réel ne peut porter cette adresse.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const C = { reset: "[0m", bold: "[1m", dim: "[2m", red: "[31m", green: "[32m" };
const TEST_DOMAIN = "@mall-express.test";

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local introuvable");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret || secret.includes("placeholder")) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises");
  process.exit(1);
}

const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

const rest = async (path, options = {}) => {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers });
  return {
    status: response.status,
    rows: response.status === 204 ? [] : await response.json().catch(() => []),
  };
};

const ids = (rows, column = "id") => rows.map((row) => row[column]).filter(Boolean);
const inList = (values) => `(${values.join(",")})`;

/* ─── Repérage ───────────────────────────────────────────────────────── */

const listed = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
if (!listed.ok) {
  console.error(`${C.red}Liste des comptes indisponible (HTTP ${listed.status})${C.reset}`);
  process.exit(1);
}

const { users = [] } = await listed.json();
const junk = users.filter((user) => user.email?.endsWith(TEST_DOMAIN));

if (junk.length === 0) {
  console.log(`\n${C.green}✓ Aucun compte de test à supprimer.${C.reset}\n`);
  // Pas de `process.exit(0)` : appelé pendant la fermeture des sockets ouverts
  // par `fetch`, il déclenche une assertion libuv sous Windows. On laisse la
  // boucle d'événements se vider, et on pose le code de sortie s'il le faut.
  process.exitCode = 0;
} else {
  await purge(junk);
}

async function purge(accounts) {
console.log(`\n${C.bold}${accounts.length} compte(s) de test${C.reset}`);
for (const user of accounts) console.log(`  ${C.dim}${user.email}${C.reset}`);

const userIds = inList(accounts.map((user) => user.id));

/* ─── Suppression, des feuilles vers la racine ───────────────────────── */

const step = async (label, path) => {
  const { status } = await rest(path, { method: "DELETE" });
  console.log(`  ${status < 300 ? `${C.green}✓${C.reset}` : `${C.red}✗ ${status}${C.reset}`} ${label}`);
};

// Boutiques détenues par ces comptes, et tout ce qui en dépend.
const { rows: shops } = await rest(`shops?select=id&owner_id=in.${userIds}`);

if (shops.length > 0) {
  const shopIds = inList(ids(shops));
  const { rows: lives } = await rest(`lives?select=id&shop_id=in.${shopIds}`);
  const { rows: sold } = await rest(`orders?select=id&shop_id=in.${shopIds}`);

  if (lives.length > 0) {
    const liveIds = inList(ids(lives));
    await step("commentaires de direct", `live_comments?live_id=in.${liveIds}`);
    await step("réactions de direct", `live_likes?live_id=in.${liveIds}`);
  }
  if (sold.length > 0) {
    const orderIds = inList(ids(sold));
    await step("lignes de commande (ventes)", `order_items?order_id=in.${orderIds}`);
    await step("commandes (ventes)", `orders?id=in.${orderIds}`);
  }

  await step("directs", `lives?shop_id=in.${shopIds}`);
  await step("produits", `products?shop_id=in.${shopIds}`);
  await step("boutiques", `shops?id=in.${shopIds}`);
}

// Commandes passées par ces comptes en tant qu'acheteurs : c'est cette clé
// étrangère qui bloque la cascade depuis auth.users.
const { rows: bought } = await rest(`orders?select=id&user_id=in.${userIds}`);
if (bought.length > 0) {
  const orderIds = inList(ids(bought));
  await step("lignes de commande (achats)", `order_items?order_id=in.${orderIds}`);
  await step("commandes (achats)", `orders?id=in.${orderIds}`);
}

await step("commentaires de direct restants", `live_comments?user_id=in.${userIds}`);
await step("réactions de direct restantes", `live_likes?user_id=in.${userIds}`);

/* ─── Comptes ────────────────────────────────────────────────────────── */

let failed = 0;
for (const user of accounts) {
  const response = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers });
  if (!response.ok) failed += 1;
  console.log(
    `  ${response.ok ? `${C.green}✓${C.reset}` : `${C.red}✗ ${response.status}${C.reset}`} ${user.email}`,
  );
}

console.log(
  failed === 0
    ? `\n${C.green}✓ Base nettoyée.${C.reset}\n`
    : `\n${C.red}${failed} compte(s) non supprimé(s).${C.reset}\n`,
);
process.exitCode = failed === 0 ? 0 : 1;
}
