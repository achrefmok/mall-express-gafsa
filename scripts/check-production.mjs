/**
 * Contrôle d'un site en ligne.
 *
 *   npm run prod:check -- https://votre-domaine
 *
 * Vérifie ce qu'on ne peut pas vérifier en local : que le déploiement porte
 * bien le code attendu, que les en-têtes de sécurité survivent à l'hébergeur,
 * et que les points d'entrée publics répondent.
 *
 * Ne touche à rien : uniquement des lectures anonymes.
 */

const target = process.argv[2]?.replace(/\/$/, "");

const C = {
  reset: "[0m", bold: "[1m", dim: "[2m",
  red: "[31m", green: "[32m", yellow: "[33m", cyan: "[36m",
};

if (!target || !/^https?:\/\//.test(target)) {
  console.error(`Usage : npm run prod:check -- https://votre-domaine`);
  process.exit(1);
}

let failed = 0;
const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const bad = (m) => { failed += 1; console.log(`  ${C.red}✗${C.reset} ${m}`); };
const warn = (m) => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const title = (m) => console.log(`\n${C.bold}${m}${C.reset}`);

async function head(path) {
  try {
    const response = await fetch(`${target}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    return response;
  } catch (cause) {
    return { status: 0, headers: new Headers(), error: cause };
  }
}

console.log(`\n${C.bold}${target}${C.reset}`);

/* ─── Le déploiement est-il accessible ? ─────────────────────────────── */

title("1 · Accessibilité");

const root = await head("/");

if (root.status === 0) {
  bad(`Injoignable : ${root.error?.message ?? "échec réseau"}`);
  process.exit(1);
}

if ((root.headers.get("location") ?? "").includes("vercel.com/sso")) {
  bad("Déploiement verrouillé par la Deployment Protection de Vercel");
  console.log(`
    Cette adresse n'est visible que connecté à Vercel — ni vos visiteurs, ni
    Google, ni Meta ne peuvent l'atteindre. Deux causes possibles :

      · c'est une adresse de ${C.bold}déploiement${C.reset} (avec un identifiant dans le
        nom), pas votre domaine de production. Promouvez-la : Deployments →
        ⋯ → « Promote to Production », ou déployez avec ${C.cyan}vercel --prod${C.reset} ;
      · la protection est activée jusque sur la production :
        Settings → Deployment Protection → désactiver pour Production.`);
  process.exit(1);
}

if (root.status !== 200) bad(`La racine répond ${root.status}`);
else ok("La racine répond 200");

/* ─── Quelle version est en ligne ? ──────────────────────────────────── */

title("2 · Version déployée");

/*
 * `/api/version` renvoie le commit que Vercel a construit. C'est la seule
 * réponse fiable à « ma modification est-elle en ligne ? » : comparer
 * l'apparence d'une page trompe, et le middleware masque les routes absentes
 * sous /vendeur en répondant 307 même quand elles n'existent pas.
 */
const version = await (async () => {
  try {
    const response = await fetch(`${target}/api/version`, {
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
})();

// Le commit local, pour la comparaison.
const local = await (async () => {
  try {
    const { execSync } = await import("node:child_process");
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();

if (!version) {
  bad("/api/version absent — ce déploiement est antérieur à son introduction");
  if (local) console.log(`    ${C.dim}Votre commit local : ${local.slice(0, 7)}${C.reset}`);
} else if (!version.commit) {
  warn(`Aucun commit rapporté (environnement : ${version.environnement})`);
} else {
  const line = `${version.court} sur ${version.branche}${version.message ? ` — ${version.message}` : ""}`;

  if (local && local === version.commit) ok(`En ligne : ${line}`);
  else if (local) {
    bad(`En ligne : ${line}`);
    console.log(`    ${C.dim}Votre local : ${local.slice(0, 7)} — le déploiement est en retard.${C.reset}`);
  } else ok(`En ligne : ${line}`);
}

/* ─── Les routes attendues ───────────────────────────────────────────── */

title("3 · Routes");

const routes = [
  ["/", 200, "présentation"],
  ["/accueil", 200, "fil de l'application"],
  ["/marketplace", 200, "marketplace"],
  ["/connexion", 200, "connexion"],
  ["/confidentialite", 200, "politique de confidentialité"],
  ["/suppression-donnees", 200, "suppression des données"],
  ["/presentation", 308, "ancienne adresse redirigée"],
  ["/robots.txt", 200, "robots"],
  ["/sitemap.xml", 200, "plan de site"],
  ["/manifest.webmanifest", 200, "manifeste PWA"],
  ["/api/version", 200, "commit déployé"],
  // Les chemins sous /vendeur sont interceptés par le middleware avant tout
  // routage : ils répondent 307 même s'ils n'existent pas. On sonde donc les
  // routes d'API, qui, elles, disent la vérité.
  ["/api/facebook/connect", 307, "liaison Facebook (refus sans session)"],
  ["/api/cron/maintenance", 401, "maintenance (refus sans jeton)"],
  ["/api/cron/facebook-sync", 401, "reprise Facebook (refus sans jeton)"],
];

for (const [path, expected, label] of routes) {
  const response = await head(path);
  if (response.status === expected) ok(`${path.padEnd(26)} ${response.status}  ${label}`);
  else bad(`${path.padEnd(26)} ${response.status} — attendu ${expected} (${label})`);
}

/* ─── En-têtes de sécurité ───────────────────────────────────────────── */

title("4 · En-têtes de sécurité");

const expectedHeaders = [
  ["content-security-policy", /default-src 'self'/, "CSP"],
  ["strict-transport-security", /max-age=\d{7,}/, "HSTS"],
  ["x-frame-options", /SAMEORIGIN|DENY/i, "X-Frame-Options"],
  ["referrer-policy", /strict-origin/, "Referrer-Policy"],
  ["permissions-policy", /camera=/, "Permissions-Policy"],
  ["x-content-type-options", /nosniff/, "X-Content-Type-Options"],
];

for (const [name, pattern, label] of expectedHeaders) {
  const value = root.headers.get(name);
  if (!value) bad(`${label} absent`);
  else if (!pattern.test(value)) warn(`${label} présent mais inattendu : ${value.slice(0, 60)}`);
  else ok(label);
}

/* ─── Cohérence du contenu ───────────────────────────────────────────── */

title("5 · Contenu");

try {
  const manifest = await (await fetch(`${target}/manifest.webmanifest`)).json();
  if (manifest.start_url === "/accueil") ok("Le manifeste PWA ouvre /accueil");
  else bad(`start_url = ${manifest.start_url} — attendu /accueil`);
} catch {
  bad("Manifeste illisible");
}

try {
  const sitemap = await (await fetch(`${target}/sitemap.xml`)).text();
  const hasLegal = sitemap.includes("/confidentialite");
  const hasShops = /\/boutique\//.test(sitemap);

  if (hasLegal) ok("Le plan de site cite les pages légales");
  else bad("Pages légales absentes du plan de site — déploiement antérieur ?");

  if (hasShops) ok("Le plan de site cite des boutiques — la base est joignable");
  else warn("Aucune boutique dans le plan de site : base injoignable, ou aucune approuvée");
} catch {
  bad("Plan de site illisible");
}

/* ─── Bilan ──────────────────────────────────────────────────────────── */

console.log(
  failed === 0
    ? `\n${C.green}✓ Rien à signaler.${C.reset}\n`
    : `\n${C.red}${failed} point(s) à corriger.${C.reset}\n`,
);

process.exitCode = failed === 0 ? 0 : 1;
