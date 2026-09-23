/**
 * Le louage, éprouvé contre la vraie base.
 *
 *   npm run db:louage
 *
 * Ce qu'on cherche à prouver tient en une phrase : deux voyageurs ne peuvent
 * pas emporter la même dernière place. Le reste — qui annonce, qui annule, qui
 * voit quoi — découle des policies de `louage_departures` et `louage_seats`.
 *
 * Le test parle donc à PostgREST avec de vraies sessions. La clé de service ne
 * sert qu'à poser le décor et à relire l'état réel de la base : s'en servir
 * pour agir traverserait précisément les règles qu'on veut éprouver.
 *
 * Hors CI, comme `db:smoke`. En cas d'interruption :
 *   node scripts/clean-test-accounts.mjs @louage.mall-express.test
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = { reset: "\u001b[0m", bold: "\u001b[1m", dim: "\u001b[2m", red: "\u001b[31m", green: "\u001b[32m", yellow: "\u001b[33m" };

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

const DOMAINE = "@louage.mall-express.test";
const MDP = "louage-mall-express-2026";

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

/** Un appel de fonction. `jeton` vaut null pour un visiteur non connecté. */
async function rpc(nom, jeton, args = {}) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { status: r.status, ok: r.ok, corps };
}

/** Le mot-clé que la fonction a levé, ou null si elle a abouti. */
const refus = (r) => (r.ok ? null : (r.corps?.message ?? String(r.corps ?? "")).replace(/^.*?(LOUAGE_[A-Z_]+).*$/s, "$1"));

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

const cree = { comptes: [] };

async function menage() {
  for (const id of cree.comptes) {
    await rest(`louage_seats?user_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await rest(`louage_departures?driver_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H_SERVICE });
  }
}

const dans = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

/** Un départ annoncé par le chauffeur lui-même, avec sa propre session. */
const annoncer = (jeton, chauffeur, extra = {}) =>
  rest("louage_departures?select=id,status", jeton, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      driver_id: chauffeur,
      driver_name: "Chauffeur d'essai",
      phone: "20 000 000",
      destination: "Gafsa → Tunis",
      seats_total: 4,
      departs_at: dans(120),
      ...extra,
    }),
  });

const reserver = (jeton, depart, places = 1) =>
  rpc("louage_reserver", jeton, {
    p_departure: depart,
    p_seats: places,
    p_name: "Voyageur d'essai",
    p_phone: "21 000 000",
  });

const statutEnBase = async (id) =>
  (await rest(`louage_departures?id=eq.${id}&select=status`, SERVICE)).corps?.[0]?.status ?? null;

const placesLibres = async (jeton, id) => {
  const r = await rpc("louage_a_venir", jeton);
  return (Array.isArray(r.corps) ? r.corps : []).find((d) => d.id === id)?.seats_left ?? null;
};

async function main() {
  console.log(`\n${C.bold}Louage — contre la vraie base${C.reset}`);
  console.log(`${C.dim}${new URL(BASE).hostname}${C.reset}\n`);

  const sonde = await rest("louage_departures?select=id&limit=1", SERVICE);
  if (!sonde.ok) {
    console.log(`${C.yellow}⚠ La migration du louage n'est pas passée — contrôle ignoré.${C.reset}`);
    console.log(`${C.dim}  supabase/migrations/20260924001000_louage_departs.sql${C.reset}\n`);
    process.exit(0);
  }

  const chauffeur = await creerCompte("chauffeur", { first_name: "Chauffeur", role: "client" });
  const voyageur = await creerCompte("voyageur", { first_name: "Voyageur", role: "client" });
  const voisin = await creerCompte("voisin", { first_name: "Voisin", role: "client" });
  if (!chauffeur || !voyageur || !voisin) {
    console.log(`${C.red}Comptes de test impossibles à créer.${C.reset}`);
    process.exit(1);
  }
  cree.comptes.push(chauffeur, voyageur, voisin);

  const jChauffeur = await jetonDe("chauffeur");
  const jVoyageur = await jetonDe("voyageur");
  const jVoisin = await jetonDe("voisin");

  /* ─── 1 · Annoncer un départ ──────────────────────────────────────── */
  console.log(`${C.bold}L'annonce${C.reset}`);

  const depart = await annoncer(jChauffeur, chauffeur);
  check("le chauffeur annonce son départ", depart.ok, true);
  check("et il commence ouvert", depart.corps?.[0]?.status, "ouvert");
  const idDepart = depart.corps?.[0]?.id;

  const usurpation = await annoncer(jChauffeur, voisin);
  check("personne n'annonce au nom d'un autre", usurpation.ok, false);

  const parAnonyme = await fetch(`${BASE}/rest/v1/louage_departures`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({
      driver_id: chauffeur, driver_name: "X", phone: "2",
      destination: "Gafsa → Tozeur", seats_total: 4, departs_at: dans(120),
    }),
  });
  check("un visiteur non connecté n'annonce pas", parAnonyme.ok, false);

  /* ─── 2 · Ce que voit le voyageur ─────────────────────────────────── */
  console.log(`\n${C.bold}La liste${C.reset}`);

  check("le départ est visible sans compte", await placesLibres(null, idDepart), 4);

  const passe = await rest("louage_departures?select=id", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      driver_id: chauffeur, driver_name: "Chauffeur d'essai", phone: "20 000 000",
      destination: "Gafsa → Sfax (hier)", seats_total: 4, departs_at: dans(-180),
    }),
  });
  const idPasse = passe.corps?.[0]?.id;
  check("un départ vieux de trois heures a quitté la liste", await placesLibres(null, idPasse), null);

  /* ─── 3 · Réserver ────────────────────────────────────────────────── */
  console.log(`\n${C.bold}La réservation${C.reset}`);

  const sansCompte = await reserver(null, idDepart, 1);
  check("un visiteur non connecté ne réserve pas", sansCompte.ok, false);

  const parEcritureDirecte = await rest("louage_seats", jVoyageur, {
    method: "POST",
    body: JSON.stringify({
      departure_id: idDepart, user_id: voyageur,
      full_name: "Voyageur d'essai", phone: "21 000 000", seats: 1,
    }),
  });
  check("l'écriture directe dans les places est refusée", parEcritureDirecte.ok, false);
  check("et rien n'a été inséré", (await rest(`louage_seats?departure_id=eq.${idDepart}&select=id`, SERVICE)).corps?.length, 0);

  const prise = await reserver(jVoyageur, idDepart, 2);
  check("le voyageur réserve deux places", prise.ok, true);
  check("il reste les deux autres", prise.corps?.[0]?.seats_left, 2);
  check("et la liste dit la même chose", await placesLibres(null, idDepart), 2);

  const parLeChauffeur = await reserver(jChauffeur, idDepart, 1);
  check("le chauffeur ne réserve pas chez lui", refus(parLeChauffeur), "LOUAGE_SOI_MEME");

  /* ─── 4 · La dernière place ───────────────────────────────────────── */
  console.log(`\n${C.bold}Le sur-remplissage${C.reset}`);

  const deuxieme = await reserver(jVoisin, idDepart, 2);
  check("le voisin prend les deux dernières", deuxieme.corps?.[0]?.seats_left, 0);
  check("le départ passe complet tout seul", await statutEnBase(idDepart), "complet");

  const detrop = await reserver(jVoyageur, idDepart, 1);
  check("la place suivante est refusée", refus(detrop), "LOUAGE_COMPLET");

  /* Deux réservations lancées ensemble sur une place unique : une seule passe. */
  const unique = await annoncer(jChauffeur, chauffeur, { seats_total: 1, destination: "Gafsa → Métlaoui" });
  const idUnique = unique.corps?.[0]?.id;
  const course = await Promise.all([reserver(jVoyageur, idUnique, 1), reserver(jVoisin, idUnique, 1)]);
  check("sur la dernière place, un seul des deux passe", course.filter((r) => r.ok).length, 1);
  check("l'autre est renvoyé, pas mis en attente", refus(course.find((r) => !r.ok)), "LOUAGE_COMPLET");
  check(
    "et une seule place existe en base",
    (await rest(`louage_seats?departure_id=eq.${idUnique}&status=eq.reservee&select=id`, SERVICE)).corps?.length,
    1,
  );

  /* ─── 5 · Qui voit les places ─────────────────────────────────────── */
  console.log(`\n${C.bold}La lecture des places${C.reset}`);

  const mesPlaces = await rest(`louage_seats?departure_id=eq.${idDepart}&select=id,user_id`, jVoyageur);
  check("le voyageur ne voit que la sienne", mesPlaces.corps?.length, 1);
  check("et c'est bien la sienne", mesPlaces.corps?.[0]?.user_id, voyageur);

  const cellesDuDepart = await rest(`louage_seats?departure_id=eq.${idDepart}&select=id`, jChauffeur);
  check("le chauffeur voit tous ses passagers", cellesDuDepart.corps?.length, 2);

  /* ─── 6 · Annuler ─────────────────────────────────────────────────── */
  console.log(`\n${C.bold}L'annulation${C.reset}`);

  const placeDuVoisin = (await rest(`louage_seats?departure_id=eq.${idDepart}&user_id=eq.${voisin}&select=id`, SERVICE)).corps?.[0]?.id;

  const parUnTiers = await rpc("louage_annuler_place", jVoyageur, { p_seat: placeDuVoisin });
  check("un tiers n'annule pas la place d'un autre", refus(parUnTiers), "LOUAGE_PAS_A_VOUS");

  const parSonProprietaire = await rpc("louage_annuler_place", jVoisin, { p_seat: placeDuVoisin });
  check("le voyageur se désiste", parSonProprietaire.ok, true);
  check("le départ complet rouvre", await statutEnBase(idDepart), "ouvert");
  check("et les places libérées reviennent", await placesLibres(null, idDepart), 2);

  const ancienne = await reserver(jVoisin, idDepart, 1);
  check("la place rendue est reprise par un autre", ancienne.ok, true);

  /* ─── 7 · Clore le départ ─────────────────────────────────────────── */
  console.log(`\n${C.bold}La clôture${C.reset}`);

  await rest(`louage_departures?id=eq.${idDepart}`, jVoyageur, {
    method: "PATCH",
    body: JSON.stringify({ status: "annule" }),
  });
  check("un voyageur n'annule pas le départ d'un chauffeur", await statutEnBase(idDepart), "ouvert");

  await rest(`louage_departures?id=eq.${idDepart}`, jChauffeur, {
    method: "PATCH",
    body: JSON.stringify({ status: "parti" }),
  });
  check("le chauffeur déclare son départ parti", await statutEnBase(idDepart), "parti");
  check("un départ parti quitte la liste", await placesLibres(null, idDepart), null);

  const surParti = await reserver(jVoyageur, idDepart, 1);
  check("et on n'y réserve plus", refus(surParti), "LOUAGE_FERME");

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
