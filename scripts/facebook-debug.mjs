/**
 * Diagnostic du relais Facebook.
 *
 *   npm run fb:debug
 *
 * Répond aux questions qu'on se pose quand « Connecter ma page » échoue :
 * quelles permissions partent réellement, le secret est-il le bon, Facebook
 * reconnaît-il l'application, et laquelle des permissions demandées refuse-t-il.
 *
 * N'affiche jamais le secret ni le jeton d'application.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRAPH = "https://graph.facebook.com/v21.0";

const C = {
  reset: "[0m", bold: "[1m", dim: "[2m",
  red: "[31m", green: "[32m", yellow: "[33m", cyan: "[36m",
};
const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const bad = (m) => console.log(`  ${C.red}✗${C.reset} ${m}`);
const warn = (m) => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const info = (m) => console.log(`    ${C.dim}${m}${C.reset}`);
const title = (m) => console.log(`\n${C.bold}${m}${C.reset}`);

/* ─── 1 · Ce que le serveur va utiliser ──────────────────────────────── */

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) {
  bad(".env.local introuvable");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const appId = env.FACEBOOK_APP_ID ?? "";
const appSecret = env.FACEBOOK_APP_SECRET ?? "";
const webhook = env.FACEBOOK_ENABLE_WEBHOOK === "1";
const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

title("1 · Configuration locale");

if (!appId) {
  bad("FACEBOOK_APP_ID est vide — la section Facebook reste masquée côté vendeur");
  process.exit(1);
}
if (!/^\d{15,17}$/.test(appId)) {
  bad(`FACEBOOK_APP_ID n'a pas la forme d'un App ID Meta : « ${appId} »`);
  info("Attendu : un nombre de 15 à 17 chiffres.");
  process.exit(1);
}
ok(`App ID : ${appId}`);

if (!appSecret) {
  bad("FACEBOOK_APP_SECRET est vide — l'échange du code d'autorisation échouera");
  process.exit(1);
}
if (/test|remplacer|factice|changez/i.test(appSecret)) {
  bad("FACEBOOK_APP_SECRET contient une valeur factice");
  info("Meta → votre app → Paramètres → Général → « Clé secrète »");
  process.exit(1);
}
ok(`Secret présent (${appSecret.length} caractères)`);

// Exactement la chaîne construite par src/lib/live/facebook-graph.ts
const scopes = [
  "pages_show_list",
  "pages_read_engagement",
  ...(webhook ? ["pages_manage_metadata"] : []),
];

console.log(
  `  ${webhook ? C.yellow + "!" : C.green + "✓"}${C.reset} Détection ${
    webhook ? "immédiate (webhook)" : "planifiée (toutes les 15 min)"
  }`,
);
info(`Permissions demandées : ${scopes.join(", ")}`);
if (webhook) {
  info("`pages_manage_metadata` est demandée : si Meta ne l'accorde pas à votre");
  info("application, le dialogue sera bloqué. Videz FACEBOOK_ENABLE_WEBHOOK.");
}

/* ─── 2 · Le secret est-il le bon ? ──────────────────────────────────── */

title("2 · L'application, vue depuis Facebook");

const appToken = await (async () => {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "client_credentials");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.access_token) {
    bad("Facebook refuse le couple App ID / secret");
    info(body?.error?.message ?? `HTTP ${response.status}`);
    info("Le secret ne correspond pas à cet App ID. Recopiez-le depuis Meta.");
    return null;
  }

  ok("Le couple App ID / secret est accepté");
  return body.access_token;
})();

if (!appToken) process.exit(1);

const app = await (async () => {
  const url = new URL(`${GRAPH}/${appId}`);
  url.searchParams.set("access_token", appToken);
  url.searchParams.set("fields", "name,link,privacy_policy_url,app_domains,category");

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    warn(`Lecture de l'application impossible : ${body?.error?.message ?? response.status}`);
    return null;
  }
  return body;
})();

if (app) {
  ok(`Nom de l'application : ${app.name ?? "(sans nom)"}`);

  if (app.privacy_policy_url) info(`Politique de confidentialité : ${app.privacy_policy_url}`);
  else {
    warn("Aucune politique de confidentialité déclarée");
    info("Exigée pour passer l'application en mode « Live » et pour la revue.");
    info("Le site en sert une — collez ces deux URL dans Meta :");
    info(`  Confidentialité       ${siteUrl}/confidentialite`);
    info(`  Suppression données   ${siteUrl}/suppression-donnees`);
  }

  const domains = app.app_domains ?? [];
  if (domains.length > 0) info(`Domaines déclarés : ${domains.join(", ")}`);
  else {
    warn("Aucun domaine déclaré dans Paramètres → Général → Domaines de l'app");
  }
}

/* ─── 3 · Le dialogue accepte-t-il ces permissions ? ─────────────────── */

title("3 · Dialogue d'autorisation");

/*
  Domaine de production passé en argument : l'URI de redirection est construite
  à l'exécution depuis l'hôte de la requête, elle diffère donc entre le poste
  de développement et le site en ligne. Les deux doivent être déclarées.

    npm run fb:debug -- https://mon-domaine.vercel.app
*/
const override = process.argv[2]?.replace(/\/$/, "");
const base = override ?? siteUrl;
const redirectUri = `${base}/api/facebook/callback`;

info(`URI de redirection sondée : ${redirectUri}`);
if (!override) {
  info("Pour sonder la production : npm run fb:debug -- https://votre-domaine");
}
console.log(`
    ${C.dim}Les deux doivent figurer dans Meta → Connexion Facebook →
    Paramètres → « URI de redirection OAuth valides » :
      ${siteUrl}/api/facebook/callback
      https://<votre-domaine>/api/facebook/callback${C.reset}`);

async function probe(scopeList) {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", "diagnostic");
  if (scopeList.length) url.searchParams.set("scope", scopeList.join(","));

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "accept-language": "fr" },
      signal: AbortSignal.timeout(20_000),
    });
    const html = await response.text();

    const invalid = /Invalid Scopes:\s*([a-z_,\s]+)/i.exec(html);
    const blocked = /URL bloqu|Blocked|n.est pas autoris|redirect_uri/i.test(html.slice(0, 6000));
    const notAvailable = /Ce contenu n.est pas disponible|isn.t available/i.test(html.slice(0, 6000));

    return { url: url.toString(), invalid: invalid?.[1]?.trim(), blocked, notAvailable };
  } catch (cause) {
    return { url: url.toString(), error: cause instanceof Error ? cause.message : "échec" };
  }
}

/*
  Une permission à la fois, pour savoir laquelle pose problème — quand on peut
  le savoir.

  Limite mesurée, pas supposée : depuis un terminal non authentifié, Meta rend
  sa page de connexion sans se prononcer. Il accepte même une URI de
  redirection jamais déclarée, et ne montre « Invalid Scopes » qu'aux
  administrateurs de l'application. Une absence de refus ici ne prouve donc
  rien ; seul un refus est une information.
*/
let sawRefusal = false;

for (const scope of scopes) {
  const result = await probe([scope]);

  if (result.error) warn(`${scope} — sondage impossible (${result.error})`);
  else if (result.invalid) {
    bad(`${scope} — refusée par l'application`);
    sawRefusal = true;
  } else if (result.blocked) {
    bad(`${scope} — URI de redirection refusée par Meta`);
    sawRefusal = true;
  } else {
    info(`${scope} — aucun refus visible (non concluant depuis un terminal)`);
  }
}

const together = await probe(scopes);

if (!sawRefusal) {
  warn("Ce terminal ne peut pas trancher : Meta diffère ses refus après connexion");
  info("Ouvrez l'URL ci-dessous dans votre navigateur, connecté à Facebook.");
}

title("À ouvrir dans votre navigateur");
console.log(`  ${C.cyan}${together.url}${C.reset}`);
console.log(`
  ${C.dim}C'est l'URL exacte que produit « Connecter ma page Facebook ».
  Connecté à Facebook, vous verrez le message réel — ce qu'un sondage
  anonyme depuis ce terminal ne peut pas reproduire : Meta ne montre
  « Invalid Scopes » qu'aux administrateurs de l'application.${C.reset}`);

if (together.notAvailable || together.invalid) {
  console.log(`
  ${C.yellow}Le sondage voit déjà un refus.${C.reset} Vérifiez dans Meta :
    · Cas d'usage : « Authentifier et demander des données aux utilisateurs
      avec Facebook Login » — et non « Facebook Login for Business »,
      qui n'accepte pas les dialogues à base de permissions ;
    · le produit « Connexion Facebook » est bien ajouté à l'application ;
    · Paramètres avancés → « Connexion OAuth du client » et « Connexion
      OAuth Web » sont activées.`);
}

console.log();
