/**
 * Promeut un compte au rôle administrateur.
 *
 *   npm run db:make-admin -- vous@exemple.com
 *
 * Le rôle `admin` ne peut pas être demandé à l'inscription : le trigger
 * handle_new_user le force à `client`, et guard_profile_privileges empêche
 * un utilisateur de modifier son propre rôle. Il faut donc la clé secrète.
 *
 * Chemin normal : la fonction SQL `grant_admin_by_email` (migration 07), qui
 * fait la recherche dans auth.users côté serveur. Repli : l'API
 * d'administration GoTrue, plus fragile — un seul compte mal formé suffit à
 * casser sa requête de liste.
 *
 * À exécuter depuis un poste de confiance : la clé secrète contourne RLS.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const C = { reset: "[0m", bold: "[1m", dim: "[2m", red: "[31m", green: "[32m", cyan: "[36m" };
const die = (message, hint) => {
  console.error(`${C.red}✗ ${message}${C.reset}`);
  if (hint) console.error(`  ${C.dim}${hint}${C.reset}`);
  process.exit(1);
};

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  die("Adresse e-mail manquante", "Usage : npm run db:make-admin -- vous@exemple.com");
}

/* ─── Environnement ──────────────────────────────────────────────────── */

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) die(".env.local introuvable");

const env = {};
for (const line of readFileSync(envPath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || url.includes("placeholder")) die("NEXT_PUBLIC_SUPABASE_URL non configurée");
if (!secret || secret.includes("placeholder") || secret.includes("publishable")) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY absente ou incorrecte",
    "Supabase → Project Settings → API Keys → onglet « Secret keys »",
  );
}

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

/* ─── Chemin normal : la fonction SQL ────────────────────────────────── */

const rpc = await fetch(`${url}/rest/v1/rpc/grant_admin_by_email`, {
  method: "POST",
  headers,
  body: JSON.stringify({ target_email: email }),
  signal: AbortSignal.timeout(20_000),
});

if (rpc.ok) {
  const id = (await rpc.json())?.toString().replace(/"/g, "");
  succeed(id);
}

if (rpc.status !== 404) {
  const body = await rpc.text();
  // Message métier de la fonction : « aucun compte pour cette adresse ».
  die(`Promotion refusée (HTTP ${rpc.status})`, body.slice(0, 400));
}

console.log(
  `  ${C.dim}grant_admin_by_email absente — repli sur l'API d'administration.${C.reset}`,
);
console.log(
  `  ${C.dim}Appliquez supabase/migrations/20260810000700_admin_bootstrap.sql.${C.reset}`,
);

/* ─── Repli : API d'administration ───────────────────────────────────── */

// L'API pagine ; on cherche page par page plutôt que de supposer que le
// compte est dans les 50 premiers.
async function findUserByList(target) {
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status === 401) {
      die("La clé secrète est refusée par ce projet", "Vérifiez qu'elle vient du même projet que l'URL.");
    }
    if (!response.ok) return { failed: true, status: response.status };

    const { users } = await response.json();
    if (!users?.length) return { user: null };

    const found = users.find((u) => u.email?.toLowerCase() === target);
    if (found) return { user: found };
  }
  return { user: null };
}

/**
 * Repli du repli. Un seul compte mal formé — colonnes de jetons à NULL après
 * une insertion manuelle dans auth.users — suffit à faire échouer la requête
 * de liste. On passe alors par les identifiants connus de `profiles`, un par
 * un : les comptes sains restent lisibles.
 */
async function findUserById(target) {
  const response = await fetch(`${url}/rest/v1/profiles?select=id`, { headers });
  if (!response.ok) return null;

  for (const { id } of await response.json()) {
    const one = await fetch(`${url}/auth/v1/admin/users/${id}`, { headers });
    if (!one.ok) continue;
    const found = await one.json();
    if (found.email?.toLowerCase() === target) return found;
  }
  return null;
}

let user;
const listed = await findUserByList(email);

if (listed.failed) {
  console.log(
    `  ${C.dim}Liste des comptes indisponible (HTTP ${listed.status}) — recherche compte par compte.${C.reset}`,
  );
  user = await findUserById(email);
} else {
  user = listed.user;
}

if (!user) {
  die(`Aucun compte pour ${email}`, "Créez-le d'abord sur /inscription, puis relancez.");
}

console.log(`${C.green}✓${C.reset} Compte trouvé : ${user.id}`);

if (!user.email_confirmed_at) {
  // Sans confirmation, la connexion échoue : on confirme au passage, puisque
  // l'administrateur est créé volontairement par l'exploitant.
  const confirm = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ email_confirm: true }),
  });
  console.log(
    confirm.ok
      ? `${C.green}✓${C.reset} E-mail confirmé`
      : `  ${C.dim}E-mail non confirmé (HTTP ${confirm.status}) — à faire depuis le tableau de bord${C.reset}`,
  );
}

const existing = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=id,role`, { headers });
const rows = existing.ok ? await existing.json() : [];

if (rows.length === 0) {
  // Le trigger handle_new_user ne s'est pas déclenché (compte créé avant les
  // migrations, par exemple) : on crée le profil manquant.
  const created = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      id: user.id,
      role: "admin",
      first_name: user.user_metadata?.first_name ?? "Administration",
      last_name: user.user_metadata?.last_name ?? null,
    }),
  });

  if (!created.ok) die(`Création du profil impossible : ${await created.text()}`);
} else {
  const update = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ role: "admin", is_banned: false }),
  });

  if (!update.ok) die(`Promotion impossible : ${await update.text()}`);

  // PostgREST renvoie 200 même quand un trigger BEFORE a annulé l'écriture :
  // il faut relire la ligne pour savoir si le rôle a réellement changé.
  const [after] = await update.json();
  if (after?.role !== "admin") {
    die(
      "Le rôle est resté « " + after?.role + " » malgré une réponse 200",
      "Les gardes annulent l'écriture : appliquez supabase/migrations/20260810000600_fix_privilege_guards.sql",
    );
  }
}

succeed(user.id);

function succeed(id) {
  console.log(`
${C.green}✓${C.reset} ${C.bold}${email} est administrateur.${C.reset} ${C.dim}${id ?? ""}${C.reset}
  Déconnectez-vous puis reconnectez-vous : le rôle est lu à l'ouverture de session.
  L'espace d'administration est sur ${C.cyan}/admin${C.reset}
  Vous pouvez y nommer d'autres administrateurs : ${C.cyan}/admin/membres${C.reset}
`);
  process.exit(0);
}
