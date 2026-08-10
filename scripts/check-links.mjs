/**
 * Détecte les liens internes qui ne mènent à aucune route.
 *
 *   npm run check:links
 *
 * Next.js ne signale pas un <Link href="/page-inexistante"> : la faute
 * n'apparaît qu'au clic, en 404. Ce script compare tous les liens écrits dans
 * `src` à l'arborescence réelle de `src/app`.
 *
 * Ne voit que les chemins statiques et les gabarits simples — un href
 * entièrement calculé lui échappe, par construction.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "src", "app");
const srcDir = join(root, "src");

const C = { reset: "[0m", bold: "[1m", dim: "[2m", red: "[31m", green: "[32m" };

function walk(dir, visit) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path, entry);
  }
}

/* ─── Routes réellement construites ──────────────────────────────────── */

const routes = [];
walk(appDir, (path, name) => {
  if (name !== "page.tsx") return;

  const segments = relative(appDir, dirname(path))
    .split(/[\\/]/)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment)); // groupes de routes

  routes.push(`/${segments.join("/")}`.replace(/\/+$/, "") || "/");
});

/* ─── Liens écrits dans le code ──────────────────────────────────────── */

/**
 * Chaque motif capture le chemin en groupe 1, et l'ouverture éventuelle
 * d'une interpolation `${` en groupe 2 : `/produit/${id}` est alors ramené à
 * `/produit/[param]`, qui correspond bien au segment dynamique `[id]`.
 */
const PATTERNS = [
  /href=\{?["`](\/[a-zA-Z0-9/_-]*)(\$\{)?/g,
  /href:\s*["`](\/[a-zA-Z0-9/_-]*)(\$\{)?/g,
  /(?:push|replace|redirect)\(["`](\/[a-zA-Z0-9/_-]*)(\$\{)?/g,
  // Destination après connexion, confirmation d'e-mail ou réinitialisation :
  // ces chemins ne sont jamais cliqués pendant le développement, donc jamais
  // testés. C'est là que les 404 se cachent le plus longtemps.
  /[?&]suite=(\/[a-zA-Z0-9/_-]*)(\$\{)?/g,
];

const links = new Map(); // lien -> fichiers qui le référencent

walk(srcDir, (path, name) => {
  // `.ts` autant que `.tsx` : les Server Actions redirigent, elles aussi.
  if (!name.endsWith(".tsx") && !name.endsWith(".ts")) return;

  const source = readFileSync(path, "utf8");
  const file = relative(root, path).replace(/\\/g, "/");

  const record = (link) => {
    if (!links.has(link)) links.set(link, new Set());
    links.get(link).add(file);
  };

  for (const pattern of PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      record(match[2] ? `${match[1]}[param]` : match[1]);
    }
  }
});

/* ─── Comparaison ────────────────────────────────────────────────────── */

const matchers = routes.map((route) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`));

const dead = [...links.entries()]
  .filter(([link]) => {
    if (link.startsWith("/icons")) return false; // fichiers statiques
    const probe = link.replace(/\/$/, "").replace(/\[param\]/g, "X") || "/";
    return !matchers.some((matcher) => matcher.test(probe));
  })
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`${C.bold}Routes construites${C.reset} : ${routes.length}`);
console.log(`${C.bold}Liens référencés${C.reset}   : ${links.size}`);

if (dead.length === 0) {
  console.log(`\n${C.green}✓ Aucun lien mort.${C.reset}\n`);
  process.exit(0);
}

console.log(`\n${C.red}${C.bold}${dead.length} lien(s) mort(s) :${C.reset}`);
for (const [link, files] of dead) {
  console.log(`  ${C.red}${link}${C.reset}`);
  for (const file of files) console.log(`    ${C.dim}${file}${C.reset}`);
}
console.log();
process.exit(1);
