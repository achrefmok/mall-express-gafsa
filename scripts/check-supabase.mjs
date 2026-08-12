/**
 * Diagnostic de la connexion Supabase.
 *
 *   npm run db:check
 *
 * Répond à trois questions :
 *   1. Les variables d'environnement sont-elles correctes ?
 *   2. La base répond-elle, et les migrations sont-elles appliquées ?
 *   3. Existe-t-il un compte administrateur ?
 *
 * N'affiche jamais la valeur d'une clé.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const C = {
  reset: "[0m",
  bold: "[1m",
  dim: "[2m",
  red: "[31m",
  green: "[32m",
  yellow: "[33m",
  cyan: "[36m",
};

const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const bad = (m) => console.log(`  ${C.red}✗${C.reset} ${m}`);
const warn = (m) => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const info = (m) => console.log(`    ${C.dim}${m}${C.reset}`);
const title = (m) => console.log(`\n${C.bold}${m}${C.reset}`);

let fatal = false;

/* ─── 1 · Variables d'environnement ──────────────────────────────────── */

title("1 · Variables d'environnement");

const envPath = join(root, ".env.local");

if (!existsSync(envPath)) {
  bad(".env.local introuvable");
  info("Copiez .env.local.example en .env.local, puis remplissez les valeurs.");
  process.exit(1);
}

const rawEnv = readFileSync(envPath);

// Un BOM UTF-8 en tête de fichier se colle au nom de la première variable,
// qui devient alors illisible pour le chargeur d'environnement.
if (rawEnv[0] === 0xef && rawEnv[1] === 0xbb && rawEnv[2] === 0xbf) {
  bad(".env.local commence par un BOM UTF-8");
  info("La première variable du fichier sera ignorée. Réenregistrez en « UTF-8 sans BOM ».");
  fatal = true;
}

const env = {};
for (const line of rawEnv.toString("utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// — URL —
if (!url) {
  bad("NEXT_PUBLIC_SUPABASE_URL est vide");
  fatal = true;
} else if (url.includes("placeholder")) {
  bad("NEXT_PUBLIC_SUPABASE_URL est encore la valeur factice");
  info("C'est la cause habituelle du « Failed to fetch » à l'inscription.");
  info("Supabase → Project Settings → API → Project URL");
  fatal = true;
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) {
  warn(`NEXT_PUBLIC_SUPABASE_URL a une forme inattendue : ${url}`);
  info("Attendu : https://<ref>.supabase.co — sans barre oblique finale, sans /rest/v1");
} else {
  ok(`URL du projet : ${url}`);
}

// — Clé anon / publishable —
const looksJwt = anon.startsWith("eyJ");
const looksPublishable = anon.startsWith("sb_publishable_");

if (!anon) {
  bad("NEXT_PUBLIC_SUPABASE_ANON_KEY est vide");
  fatal = true;
} else if (anon.includes("placeholder")) {
  bad("NEXT_PUBLIC_SUPABASE_ANON_KEY est encore la valeur factice");
  fatal = true;
} else if (looksJwt || looksPublishable) {
  ok(`Clé publique présente (${looksJwt ? "JWT anon" : "publishable"}, ${anon.length} caractères)`);
} else {
  warn("NEXT_PUBLIC_SUPABASE_ANON_KEY n'a ni la forme d'un JWT ni celle d'une clé publishable");
}

// — URL publique du site —
// Elle sert aux redirections OAuth, au plan de site et aux URL canoniques.
// Une valeur qui ne correspond pas au port réellement servi casse la connexion
// Google/Facebook en local ; laissée sur localhost, elle casse tout en ligne.
const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";

if (!siteUrl) {
  warn("NEXT_PUBLIC_SITE_URL est vide — l'origine sera déduite de la requête");
} else if (/localhost|127\.0\.0\.1/.test(siteUrl)) {
  const port = /:(\d+)/.exec(siteUrl)?.[1] ?? "80";
  warn(`NEXT_PUBLIC_SITE_URL pointe sur ${siteUrl}`);
  info(`Vérifiez que « npm run dev » sert bien le port ${port} : sinon les`);
  info("redirections OAuth et les URL du plan de site viseront le mauvais port.");
  info("En production, remplacez par le domaine réel.");
} else {
  ok(`URL publique du site : ${siteUrl}`);
}

// — Clé service_role —
if (!service || service.includes("placeholder")) {
  warn("SUPABASE_SERVICE_ROLE_KEY absente — seule /api/cron/maintenance en a besoin");
} else if (service.includes("publishable") || service === anon) {
  bad("SUPABASE_SERVICE_ROLE_KEY contient une clé PUBLIQUE, pas la clé secrète");
  info("Il faut la clé « service_role » (JWT eyJ…) ou « secret » (sb_secret_…).");
  info("Supabase → Project Settings → API Keys → onglet « Secret keys »");
  info("Sans elle, seule la maintenance planifiée est bloquée : l'application fonctionne.");
} else if (service.startsWith("eyJ") || service.startsWith("sb_secret_")) {
  ok("Clé secrète présente");
} else {
  warn(`SUPABASE_SERVICE_ROLE_KEY a une forme inattendue (${service.length} caractères)`);
  info("Attendu : un JWT « eyJ… » ou une clé « sb_secret_… ».");
}

if (fatal) {
  console.log(
    `\n${C.red}${C.bold}Arrêt :${C.reset} corrigez les points ci-dessus puis relancez ${C.cyan}npm run db:check${C.reset}\n`,
  );
  process.exit(1);
}

/* ─── 2 · Connexion et schéma ────────────────────────────────────────── */

title("2 · Connexion à la base");

const headers = { apikey: anon, Authorization: `Bearer ${anon}` };

async function rest(path, extra = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { ...headers, ...extra },
    signal: AbortSignal.timeout(15_000),
  });
  return response;
}

/**
 * Confirmation d'e-mail à l'inscription.
 *
 * Deux conséquences quand elle est active : le nouveau compte ne peut pas se
 * connecter avant d'avoir cliqué le lien, et surtout chaque inscription
 * consomme un envoi du mailer intégré — plafonné à quelques courriels par
 * heure. Au-delà, l'inscription répond 429 pour tout le monde.
 */
async function reportEmailConfirmation() {
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return;

    const settings = await response.json();

    if (settings.disable_signup) {
      bad("Les inscriptions sont désactivées sur ce projet");
      info("Supabase → Authentication → Sign In / Providers → « Allow new users to sign up »");
    }

    /*
      Google et Facebook ne s'activent pas dans le code : il faut un
      identifiant client et un secret, collés dans le tableau de bord. Tant
      que ce n'est pas fait, l'application masque les deux boutons — mieux
      qu'un bouton menant à « Unsupported provider ».
    */
    const providers = ["google", "facebook"].filter((p) => settings.external?.[p]);
    const projectRef = /https:\/\/([a-z0-9-]+)\./.exec(url)?.[1] ?? "<ref>";

    /*
      Un fournisseur « activé » peut malgré tout être mal renseigné. Le symptôme
      arrive chez le visiteur, pas ici : Facebook affiche « ID d'app non valide »
      et Google « invalid_client ». La cause la plus fréquente est d'avoir collé
      autre chose que l'identifiant client dans le champ prévu.

      On suit la redirection d'autorisation sans l'exécuter, et on lit le
      `client_id` que Supabase transmet réellement. Ce n'est pas un secret : il
      voyage dans l'URL du navigateur à chaque connexion.
    */
    const SHAPES = {
      facebook: {
        valid: (id) => /^\d{15,17}$/.test(id),
        expected: "un nombre de 15 à 17 chiffres (App ID Meta)",
        where: "developers.facebook.com → votre app → Paramètres → Général → « Identifiant de l'app »",
      },
      google: {
        valid: (id) => /^[\w-]+\.apps\.googleusercontent\.com$/.test(id),
        expected: "…​.apps.googleusercontent.com",
        where: "console.cloud.google.com → Identifiants → ID client OAuth 2.0",
      },
    };

    for (const provider of providers) {
      try {
        const probe = await fetch(
          `${url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(`${siteUrl || "http://localhost:3000"}/auth/callback`)}`,
          { headers, redirect: "manual", signal: AbortSignal.timeout(10_000) },
        );

        const location = probe.headers.get("location");
        if (!location) continue;

        const clientId = new URL(location).searchParams.get("client_id") ?? "";
        const shape = SHAPES[provider];

        if (shape.valid(clientId)) {
          ok(`${provider} : identifiant client correct (${clientId.slice(0, 8)}…)`);

          /*
            La forme est bonne, mais l'application existe-t-elle vraiment chez
            le fournisseur ? On ouvre la page de dialogue : si le fournisseur
            reconnaît l'app, il présente sa page de connexion en reprenant
            l'identifiant ; sinon il rend une page d'erreur.
          */
          try {
            const dialog = await fetch(location, {
              redirect: "follow",
              signal: AbortSignal.timeout(10_000),
            });
            const page = await dialog.text();

            const rejected = /ID d.app non valide|Invalid App ID|invalid_client|Erreur OAuth/i.test(
              page.slice(0, 6000),
            );
            const recognised = dialog.url.includes(clientId) || /login/i.test(dialog.url);

            if (rejected) {
              bad(`${provider} refuse cet identifiant — l'application n'existe pas chez lui`);
              info("Vérifiez que l'App ID vient bien de l'application que vous avez créée.");
            } else if (recognised) {
              ok(`${provider} reconnaît l'application`);
              info("Reste à vérifier, dans la console du fournisseur :");
              info("  · l'app est en mode « Live » — en développement, seuls ses");
              info("    administrateurs et testeurs peuvent se connecter ;");
              info(`  · l'URI de redirection déclarée est ${url}/auth/v1/callback`);
              info("Et dans Supabase → Authentication → URL Configuration,");
              info("que « Redirect URLs » contienne l'adresse de votre site.");
            }
          } catch {
            warn(`${provider} : page de dialogue injoignable — contrôle partiel`);
          }
        } else {
          bad(`${provider} : l'identifiant client est invalide`);
          info(`Supabase transmet : « ${clientId || "(vide)"} »`);
          info(`Attendu : ${shape.expected}`);
          info(shape.where);
          info(`À coller dans Supabase → Authentication → Providers → ${provider}`);
          info(`URI de redirection à déclarer chez le fournisseur :`);
          info(`  ${url}/auth/v1/callback`);
        }
      } catch {
        warn(`${provider} : vérification de l'identifiant client impossible`);
      }
    }

    if (providers.length === 2) {
      ok("Connexion Google et Facebook activées");
    } else if (providers.length === 1) {
      warn(`Seul ${providers[0]} est activé — l'autre bouton reste masqué`);
    } else {
      warn("Ni Google ni Facebook ne sont activés — les deux boutons sont masqués");
      console.log(`
    ${C.bold}Pour les activer :${C.reset}
    Supabase → Authentication → Sign In / Providers → Google (puis Facebook)

    Il faut un identifiant client et un secret :
      Google   ${C.cyan}console.cloud.google.com${C.reset} → API et services → Identifiants
      Facebook ${C.cyan}developers.facebook.com${C.reset} → votre app → Connexion Facebook

    ${C.bold}URI de redirection à déclarer chez Google et chez Meta :${C.reset}
      ${C.cyan}https://${projectRef}.supabase.co/auth/v1/callback${C.reset}

    ${C.bold}Et dans Supabase → Authentication → URL Configuration :${C.reset}
      Site URL       ${C.cyan}${siteUrl || "<votre domaine>"}${C.reset}
      Redirect URLs  ${C.cyan}${(siteUrl || "<votre domaine>").replace(/\/$/, "")}/auth/callback${C.reset}`);
    }

    if (settings.mailer_autoconfirm) {
      ok("Confirmation d'e-mail désactivée — inscription immédiate");
    } else {
      warn("La confirmation d'e-mail est active");
      info("Chaque inscription consomme un envoi du mailer intégré, plafonné à");
      info("quelques courriels par heure : au-delà, l'inscription répond 429.");
      info("Supabase → Authentication → Sign In / Providers → décochez « Confirm email »");
      info("En attendant, l'application confirme elle-même avec la clé secrète.");
    }
  } catch {
    // Diagnostic accessoire : son échec ne doit pas interrompre le reste.
  }
}

try {
  const response = await fetch(`${url}/auth/v1/health`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });

  if (response.ok) {
    ok("Le service d'authentification répond");
    await reportEmailConfirmation();
  } else if (response.status === 401) {
    bad("401 — la clé publique est refusée par ce projet");
    info("Vérifiez que l'URL et la clé viennent bien du MÊME projet Supabase.");
    process.exit(1);
  } else {
    warn(`Authentification : HTTP ${response.status}`);
  }
} catch (cause) {
  bad(`Injoignable : ${cause instanceof Error ? cause.message : cause}`);
  info("Projet en pause (les projets gratuits s'arrêtent après 7 jours d'inactivité) ?");
  info("Faute de frappe dans l'URL ? Réseau ou pare-feu ?");
  process.exit(1);
}

title("3 · Migrations");

const TABLES = [
  "profiles",
  "categories",
  "shops",
  "shop_hours",
  "shop_categories",
  "shop_follows",
  "products",
  "promotions",
  "favorites",
  "cart_items",
  "reviews",
  "orders",
  "order_items",
  "lives",
  "live_comments",
  "live_likes",
  "deals",
  "deal_votes",
  "deal_comments",
  "reports",
  "conversations",
  "messages",
  "notifications",
  "loyalty_transactions",
  "referrals",
  "sponsored_slots",
  "city_infos",
  "city_alerts",
  "practical_services",
  "prayer_times",
  "pharmacies_on_duty",
  "service_requests",
];

const missing = [];

for (const table of TABLES) {
  try {
    const response = await rest(`${table}?select=*&limit=0`, { Prefer: "count=exact" });
    // 200 = lisible ; 401/403 = la table existe mais RLS bloque la lecture anonyme,
    // ce qui est le comportement attendu pour les tables privées.
    if (!response.ok && response.status !== 401 && response.status !== 403) {
      missing.push(table);
    }
  } catch {
    missing.push(table);
  }
}

if (missing.length === 0) {
  ok(`Les ${TABLES.length} tables sont présentes`);
} else if (missing.length === TABLES.length) {
  bad("Aucune table trouvée — les migrations n'ont pas été appliquées");
  info("npx supabase link --project-ref <ref> && npx supabase db push");
  info("ou : collez supabase/migrations/*.sql dans l'éditeur SQL, dans l'ordre des noms.");
  process.exit(1);
} else {
  bad(`${missing.length} table(s) manquante(s) : ${missing.join(", ")}`);
  info("Une migration n'est pas passée. Rejouez-les dans l'ordre.");
}

/**
 * Présence d'une fonction SQL, via PostgREST.
 *
 * 404 = la fonction n'existe pas, donc la migration n'est pas passée.
 * 401/403 = elle existe mais refuse l'appel anonyme, ce qui est le
 * comportement attendu pour les fonctions réservées aux administrateurs.
 */
async function hasFunction(name, body = "{}") {
  try {
    const probe = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });
    return probe.status !== 404;
  } catch {
    return null;
  }
}

// La migration 06 corrige les gardes de privilèges. Sans elle, la promotion
// d'un administrateur et l'approbation des boutiques restent sans effet.
const has06 = await hasFunction("is_service_context");

if (has06 === null) {
  warn("Vérification du correctif des gardes impossible");
} else if (has06) {
  ok("06 · Correctif des gardes de privilèges appliqué");
} else {
  bad("Migration 20260810000600 non appliquée");
  info("Sans elle : `update profiles set role = 'admin'` reste sans effet,");
  info("et le seed n'arrive pas à approuver les boutiques.");
  info("Collez supabase/migrations/20260810000600_fix_privilege_guards.sql");
  info("dans l'éditeur SQL de Supabase.");
}

// La migration 07 crée le premier administrateur et les fonctions qui lui
// permettent d'en nommer d'autres depuis /admin/membres.
const has07 = await hasFunction("admin_members", JSON.stringify({ search: null }));

if (has07 === null) {
  warn("Vérification de l'amorçage administrateur impossible");
} else if (has07) {
  ok("07 · Gestion de l'équipe disponible");
} else {
  bad("Migration 20260810000700 non appliquée");
  info("Sans elle : pas de premier administrateur, et /admin/membres ne peut");
  info("ni afficher les adresses ni nommer un collègue.");
  info("Collez supabase/migrations/20260810000700_admin_bootstrap.sql");
  info("dans l'éditeur SQL de Supabase, APRÈS la 06.");
}

// La migration 08 apporte le relais automatique des directs Facebook.
const has08 = await hasFunction("sync_facebook_live", JSON.stringify({
  target_shop: "00000000-0000-0000-0000-000000000000",
  video_id: "", permalink: "", video_title: "", live_now: false,
}));

if (has08 === null) {
  warn("Vérification du relais Facebook impossible");
} else if (has08) {
  ok("08 · Relais automatique des directs Facebook disponible");
} else {
  warn("Migration 20260811000800 non appliquée");
  info("Sans elle, une boutique ne peut pas relier sa page Facebook :");
  info("le relais reste manuel (coller le lien du direct).");
  info("npm run db:sql -- 000800");
}

/*
  La migration 09 ajoute la colonne que réclame le rappel de suppression de
  Meta. Une colonne absente ne se voit pas au démarrage : elle se manifeste le
  jour où un commerçant retire l'application, par un 500 côté Facebook.
*/
try {
  const probe = await rest("shop_facebook_pages?select=facebook_user_id&limit=0");
  if (probe.status === 400) {
    warn("Migration 20260812000900 non appliquée");
    info("La colonne facebook_user_id manque : le rappel de suppression de");
    info("données de Meta répondra 500. npm run db:sql -- 000900");
  } else if (probe.ok || probe.status === 401 || probe.status === 403) {
    ok("09 · Rappel de suppression des données prêt");
  }
} catch {
  warn("Vérification du rappel de suppression impossible");
}

/* ─── 4 · Données de référence ───────────────────────────────────────── */

title("4 · Données de référence");

async function countOf(table) {
  try {
    const response = await rest(`${table}?select=*&limit=1`, { Prefer: "count=exact" });
    const range = response.headers.get("content-range"); // « 0-0/12 »
    return range ? Number.parseInt(range.split("/")[1], 10) : null;
  } catch {
    return null;
  }
}

const categories = await countOf("categories");
const services = await countOf("practical_services");
const shops = await countOf("shops");
const products = await countOf("products");

if (categories === 0) {
  warn("Aucune catégorie — le référentiel n'est pas chargé");
  info("Exécutez la PARTIE A de supabase/seed.sql (obligatoire, même en production).");
} else {
  ok(`${categories} catégories · ${services ?? "?"} services pratiques`);
}

info(`Boutiques approuvées visibles : ${shops ?? 0} · Produits en ligne : ${products ?? 0}`);

/* ─── 5 · Comptes administrateurs ────────────────────────────────────── */

title("5 · Comptes administrateurs");

try {
  const response = await rest("profiles?select=id,first_name,last_name,role&role=eq.admin");

  if (!response.ok) {
    warn(`Lecture des profils impossible (HTTP ${response.status})`);
  } else {
    const admins = await response.json();

    if (admins.length === 0) {
      warn("Aucun administrateur");
      console.log(`
    ${C.bold}Pour créer le premier :${C.reset}
    Ouvrez ${C.cyan}supabase/migrations/20260810000700_admin_bootstrap.sql${C.reset},
    renseignez l'adresse et le mot de passe en tête de fichier, puis collez-le
    dans l'éditeur SQL de Supabase. Le compte est créé et promu d'un coup.

    ${C.bold}Pour promouvoir un compte existant :${C.reset}
    ${C.cyan}npm run db:make-admin -- vous@exemple.com${C.reset}

    Les suivants se nomment depuis l'interface, sur ${C.cyan}/admin/membres${C.reset}.

    Le rôle « admin » ne peut pas être demandé à l'inscription : le trigger
    handle_new_user le neutralise, pour que personne ne se promeuve seul.`);
    } else {
      ok(`${admins.length} administrateur(s)`);
      for (const admin of admins) {
        const name = [admin.first_name, admin.last_name].filter(Boolean).join(" ") || "(sans nom)";
        info(`${name} — ${admin.id}`);
      }
    }

    const total = await countOf("profiles");
    info(`Comptes au total : ${total ?? "?"}`);
  }
} catch (cause) {
  warn(`Lecture des profils impossible : ${cause instanceof Error ? cause.message : cause}`);
}

/* ─── Bilan ──────────────────────────────────────────────────────────── */

title("Rappel");
console.log(`  Après toute modification de .env.local, ${C.bold}redémarrez${C.reset} le serveur :
  les variables sont lues une seule fois au démarrage.\n`);
