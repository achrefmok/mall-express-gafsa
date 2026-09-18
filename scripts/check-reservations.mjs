/**
 * Les réservations, éprouvées contre la vraie base.
 *
 *   npm run db:reservations
 *
 * Ce qu'on cherche à prouver tient en une phrase : un client ne décide pas de
 * sa réservation, et un commerçant ne décide que des siennes. Les deux règles
 * vivent dans les policies de `reservations` — ce test parle donc à PostgREST
 * avec de vraies sessions, jamais avec la clé de service, qui les traverse.
 *
 * Hors CI, comme `db:smoke`. En cas d'interruption :
 *   node scripts/clean-test-accounts.mjs @reservations.mall-express.test
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = { reset: "[0m", bold: "[1m", dim: "[2m", red: "[31m", green: "[32m", yellow: "[33m" };

let ko = 0;
const check = (nom, reel, attendu) => {
  const ok = JSON.stringify(reel) === JSON.stringify(attendu);
  if (!ok) ko++;
  console.log(
    `  ${ok ? `${C.green}ok ${C.reset}` : `${C.red}KO ${C.reset}`} ${nom}` +
      (ok ? "" : `\n       obtenu ${JSON.stringify(reel)}\n       attendu ${JSON.stringify(attendu)}`),
  );
};

const env = {};
if (existsSync(join(root, ".env.local"))) {
  for (const l of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const BASE = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BASE || !SERVICE || !ANON) {
  console.log(`\n${C.yellow}⚠ Variables Supabase absentes — contrôle ignoré (hors CI par conception).${C.reset}\n`);
  process.exit(0);
}

const DOMAINE = "@reservations.mall-express.test";
const MDP = "reservations-mall-express-2026";

async function rest(chemin, jeton, options = {}) {
  const r = await fetch(`${BASE}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: jeton === SERVICE ? SERVICE : ANON,
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { status: r.status, ok: r.ok, corps };
}

const H_SERVICE = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function creerCompte(cle, meta = {}) {
  const r = await fetch(`${BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: H_SERVICE,
    body: JSON.stringify({ email: `${cle}${DOMAINE}`, password: MDP, email_confirm: true, user_metadata: meta }),
  });
  return (await r.json())?.id ?? null;
}

async function jetonDe(cle) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${cle}${DOMAINE}`, password: MDP }),
  });
  return (await r.json())?.access_token ?? null;
}

const cree = { comptes: [], boutiques: [] };

async function menage() {
  for (const id of cree.boutiques) {
    await rest(`reservations?shop_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await rest(`shops?id=eq.${id}`, SERVICE, { method: "DELETE" });
  }
  for (const id of cree.comptes) {
    await rest(`reservations?user_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await rest(`shops?owner_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H_SERVICE });
  }
}

const DEMAIN = new Date(Date.now() + 86_400_000).toISOString();

/** Une demande, envoyée par le client lui-même. */
const demander = (jeton, client, boutique, extra = {}) =>
  rest("reservations?select=id,status", jeton, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      shop_id: boutique,
      user_id: client,
      full_name: "Client d'essai",
      phone: "20 000 000",
      party_size: 2,
      desired_at: DEMAIN,
      ...extra,
    }),
  });

async function main() {
  console.log(`\n${C.bold}Réservations — contre la vraie base${C.reset}`);
  console.log(`${C.dim}${new URL(BASE).hostname}${C.reset}\n`);

  const sonde = await rest("reservations?select=id&limit=1", SERVICE);
  if (!sonde.ok) {
    console.log(`${C.yellow}⚠ La migration des réservations n'est pas passée — contrôle ignoré.${C.reset}\n`);
    process.exit(0);
  }

  const client = await creerCompte("client", { first_name: "Client", role: "client" });
  const voisin = await creerCompte("voisin", { first_name: "Voisin", role: "client" });
  const marchand = await creerCompte("marchand", { first_name: "Marchand", role: "vendor" });
  if (!client || !voisin || !marchand) {
    console.log(`${C.red}Comptes de test impossibles à créer.${C.reset}`);
    process.exit(1);
  }
  cree.comptes.push(client, voisin, marchand);

  const jetonClient = await jetonDe("client");
  const jetonVoisin = await jetonDe("voisin");
  const jetonMarchand = await jetonDe("marchand");

  /* Deux boutiques : celle qui réserve, et celle qui ne réserve pas. */
  const ouverte = await rest("shops?select=id", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: marchand,
      slug: `essai-reserve-${Date.now()}`,
      name: "Essai réservations",
      status: "approved",
      accepts_reservations: true,
    }),
  });
  const fermee = await rest("shops?select=id", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: voisin,
      slug: `essai-sans-${Date.now()}`,
      name: "Essai sans réservation",
      status: "approved",
      accepts_reservations: false,
    }),
  });
  const idOuverte = ouverte.corps?.[0]?.id;
  const idFermee = fermee.corps?.[0]?.id;
  cree.boutiques.push(idOuverte, idFermee);

  /* ─── 1 · Qui peut demander ───────────────────────────────────────── */
  console.log(`${C.bold}La demande${C.reset}`);

  const demande = await demander(jetonClient, client, idOuverte);
  check("le client réserve chez qui l'accepte", demande.ok, true);
  check("et la demande commence en attente", demande.corps?.[0]?.status, "pending");

  const chezFermee = await demander(jetonClient, client, idFermee);
  check("il ne réserve pas chez qui refuse les réservations", chezFermee.ok, false);

  const pourAutrui = await demander(jetonClient, voisin, idOuverte);
  check("il ne réserve pas au nom d'un autre", pourAutrui.ok, false);

  const anonyme = await fetch(`${BASE}/rest/v1/reservations`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: idOuverte, user_id: client, full_name: "X", phone: "2", desired_at: DEMAIN }),
  });
  check("un visiteur non connecté ne réserve pas", anonyme.ok, false);

  const idDemande = demande.corps?.[0]?.id;

  /* ─── 2 · Qui peut la lire ────────────────────────────────────────── */
  console.log(`\n${C.bold}La lecture${C.reset}`);

  const parLeClient = await rest(`reservations?id=eq.${idDemande}&select=id`, jetonClient);
  check("le client voit la sienne", parLeClient.corps?.length, 1);

  const parLeMarchand = await rest(`reservations?id=eq.${idDemande}&select=id`, jetonMarchand);
  check("le commerçant voit celles de sa boutique", parLeMarchand.corps?.length, 1);

  const parLeVoisin = await rest(`reservations?id=eq.${idDemande}&select=id`, jetonVoisin);
  check("personne d'autre ne les voit", parLeVoisin.corps?.length, 0);

  /* ─── 3 · Qui décide ──────────────────────────────────────────────── */
  console.log(`\n${C.bold}La décision${C.reset}`);

  await rest(`reservations?id=eq.${idDemande}`, jetonClient, {
    method: "PATCH",
    body: JSON.stringify({ status: "accepted" }),
  });
  const apresAutoAcceptation = await rest(`reservations?id=eq.${idDemande}&select=status`, SERVICE);
  check("le client ne s'accepte pas lui-même", apresAutoAcceptation.corps?.[0]?.status, "pending");

  await rest(`reservations?id=eq.${idDemande}`, jetonVoisin, {
    method: "PATCH",
    body: JSON.stringify({ status: "accepted" }),
  });
  const apresEtranger = await rest(`reservations?id=eq.${idDemande}&select=status`, SERVICE);
  check("un tiers non plus", apresEtranger.corps?.[0]?.status, "pending");

  await rest(`reservations?id=eq.${idDemande}`, jetonMarchand, {
    method: "PATCH",
    body: JSON.stringify({ status: "accepted", handled_at: new Date().toISOString() }),
  });
  const apresMarchand = await rest(`reservations?id=eq.${idDemande}&select=status`, SERVICE);
  check("le commerçant accepte la sienne", apresMarchand.corps?.[0]?.status, "accepted");

  /* ─── 4 · L'annulation ────────────────────────────────────────────── */
  console.log(`\n${C.bold}L'annulation${C.reset}`);

  await rest(`reservations?id=eq.${idDemande}`, jetonClient, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  const apresAnnulationTardive = await rest(`reservations?id=eq.${idDemande}&select=status`, SERVICE);
  check("une demande acceptée ne s'annule plus d'un clic", apresAnnulationTardive.corps?.[0]?.status, "accepted");

  const seconde = await demander(jetonClient, client, idOuverte);
  await rest(`reservations?id=eq.${seconde.corps?.[0]?.id}`, jetonClient, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  const apresAnnulation = await rest(`reservations?id=eq.${seconde.corps?.[0]?.id}&select=status`, SERVICE);
  check("tant qu'elle attend, le client se désiste", apresAnnulation.corps?.[0]?.status, "cancelled");

  console.log(
    ko === 0
      ? `\n${C.green}${C.bold}Tout est vert.${C.reset}\n`
      : `\n${C.red}${C.bold}${ko} contrôle(s) en échec.${C.reset}\n`,
  );
}

try {
  await main();
} finally {
  await menage();
}

process.exit(ko === 0 ? 0 : 1);
