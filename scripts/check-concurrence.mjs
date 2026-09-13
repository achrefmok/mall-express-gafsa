/**
 * Les trois cas qui ne se testent pas à la main.
 *
 *   npm run db:concurrence
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi ce script n'est pas dans la CI
 * ────────────────────────────────────────────────────────────────────────
 *
 * Il écrit dans une vraie base — c'est tout son intérêt. Les garanties qu'il
 * vérifie ne vivent pas dans le code TypeScript mais dans Postgres : une mise
 * à jour conditionnelle, une contrainte, une policy. Un test qui simulerait
 * la base ne prouverait que la qualité du simulacre.
 *
 * Il rejoint donc `db:smoke` et `db:check` parmi les contrôles manuels, pour
 * la même raison qu'eux : `npm run check` doit rester exécutable sans
 * secrets, par n'importe qui, sans effet de bord.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'il éprouve
 * ────────────────────────────────────────────────────────────────────────
 *
 *   1. Deux chauffeurs acceptent la même demande dans la même milliseconde.
 *      Un seul doit gagner. C'est la garantie la plus importante du module :
 *      deux voitures envoyées au même client, ou un client facturé deux fois,
 *      sont des pannes dont on ne se remet pas commercialement.
 *
 *   2. Un chauffeur perd son GPS pendant qu'un client cherche. Il doit rester
 *      joignable — c'est tout l'objet de `taxi-presence.ts` — mais quitter la
 *      carte, faute de position à y placer.
 *
 *   3. Un chauffeur passe hors ligne pendant une recherche. Il doit
 *      disparaître du matching immédiatement, et ne plus pouvoir être proposé.
 *
 * Tout est créé puis effacé. En cas d'interruption, le ménage se rattrape :
 *   node scripts/clean-test-accounts.mjs @concurrence.mall-express.test
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const C = {
  reset: "[0m", bold: "[1m", dim: "[2m",
  red: "[31m", green: "[32m", yellow: "[33m",
};

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(
    `  ${ok ? `${C.green}ok ${C.reset}` : `${C.red}KO ${C.reset}`} ${nom}` +
      (ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`),
  );
};

/* ─── Configuration ───────────────────────────────────────────────────── */

const env = {};
if (existsSync(join(root, ".env.local"))) {
  for (const l of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !CLE) {
  console.log(
    `\n${C.yellow}⚠ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires.${C.reset}\n` +
      `  Ce contrôle écrit dans une vraie base ; il est volontairement hors CI.\n`,
  );
  process.exit(0);
}

const DOMAINE = "@concurrence.mall-express.test";
const H = { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" };

async function rest(chemin, options = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...H, ...(options.headers ?? {}) },
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { status: r.status, ok: r.ok, corps };
}

async function creerCompte(cle, nom) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      email: `${cle}${DOMAINE}`,
      password: "concurrence-mall-express-2026",
      email_confirm: true,
      user_metadata: { first_name: nom },
    }),
  });
  const corps = await r.json();
  return corps?.id ?? null;
}

async function supprimerCompte(id) {
  await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
}

/* ─── Le décor ────────────────────────────────────────────────────────── */

const GAFSA = { lat: 34.4245, lng: 8.7842 };
const cree = { comptes: [], demandes: [] };

async function menage() {
  for (const id of cree.demandes) {
    await rest(`taxi_request_matches?request_id=eq.${id}`, { method: "DELETE" });
    await rest(`taxi_requests?id=eq.${id}`, { method: "DELETE" });
  }
  for (const id of cree.comptes) {
    await rest(`taxi_request_matches?driver_id=eq.${id}`, { method: "DELETE" });
    await rest(`taxi_requests?driver_id=eq.${id}`, { method: "DELETE" });
    await rest(`taxi_requests?client_id=eq.${id}`, { method: "DELETE" });
    await rest(`taxi_drivers?id=eq.${id}`, { method: "DELETE" });
    await supprimerCompte(id);
  }
}

async function main() {
  console.log(`\n${C.bold}Concurrence, GPS et mise hors ligne${C.reset}`);
  console.log(`${C.dim}${new URL(URL_BASE).hostname}${C.reset}\n`);

  // Un client et deux chauffeurs.
  const client = await creerCompte("client", "Client Concurrence");
  const a = await creerCompte("chauffeur-a", "Chauffeur A");
  const b = await creerCompte("chauffeur-b", "Chauffeur B");

  if (!client || !a || !b) {
    console.log(`${C.red}✗ Les comptes de test n'ont pas pu être créés.${C.reset}\n`);
    await menage();
    process.exit(1);
  }
  cree.comptes.push(client, a, b);

  const ficheChauffeur = (id, nom, tel) => ({
    id,
    display_name: nom,
    phone: tel,
    is_approved: true,
    status: "libre",
    status_since: new Date().toISOString(),
    is_available: true,
    lat: GAFSA.lat,
    lng: GAFSA.lng,
    position_updated_at: new Date().toISOString(),
    seats_total: 4,
    seats_free: 4,
    origin_zone: "gafsa_centre",
    destination_zone: "lella",
    accepts_custom: true,
  });

  await rest("taxi_drivers", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([
      ficheChauffeur(a, "Chauffeur A", "29000001"),
      ficheChauffeur(b, "Chauffeur B", "29000002"),
    ]),
  });

  /* ═══ 1 · Deux acceptations simultanées ═══════════════════════════════ */

  console.log(`${C.bold}Deux chauffeurs, une demande${C.reset}`);

  const creation = await rest("taxi_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: client,
      pickup_lat: GAFSA.lat,
      pickup_lng: GAFSA.lng,
      origin_zone: "gafsa_centre",
      destination_zone: "lella",
      destination_type: "zone",
      seats: 1,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    }),
  });

  const demande = Array.isArray(creation.corps) ? creation.corps[0] : null;

  if (!demande?.id) {
    console.log(`  ${C.red}KO ${C.reset} la demande n'a pas pu être créée — ${JSON.stringify(creation.corps)}`);
    ko++;
  } else {
    cree.demandes.push(demande.id);

    /*
      Les deux partent ensemble, et c'est le cœur du test.

      En série, le second lirait un état déjà écrit et échouerait pour une
      mauvaise raison. `Promise.all` les envoie dans la même fenêtre, et c'est
      Postgres qui départage — exactement comme deux téléphones réels.

      `Prefer: return=representation` fait rendre les lignes touchées : le
      gagnant en rend une, le perdant zéro. C'est cette différence qu'on lit,
      et non un code d'erreur — la mise à jour conditionnelle ne « rate » pas,
      elle ne trouve simplement rien à écrire.
    */
    const accepter = (driverId) =>
      rest(
        `taxi_requests?id=eq.${demande.id}&status=eq.en_attente&driver_id=is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            driver_id: driverId,
            status: "acceptee",
            responded_at: new Date().toISOString(),
          }),
        },
      );

    const [ra, rb] = await Promise.all([accepter(a), accepter(b)]);

    const gagnants =
      (Array.isArray(ra.corps) ? ra.corps.length : 0) +
      (Array.isArray(rb.corps) ? rb.corps.length : 0);

    check("un seul chauffeur emporte la course", gagnants, 1);

    const apres = await rest(`taxi_requests?id=eq.${demande.id}&select=driver_id,status`);
    const ligne = Array.isArray(apres.corps) ? apres.corps[0] : null;

    check("la course porte un chauffeur, et un seul", ligne?.driver_id === a || ligne?.driver_id === b, true);
    check("son statut est « acceptee »", ligne?.status, "acceptee");

    /*
      Le perdant ne doit pas pouvoir repasser derrière.

      C'est le second temps du même défaut : un chauffeur qui rouvre son écran
      trente secondes plus tard et touche « accepter » sur une carte périmée.
    */
    const perdant = ligne?.driver_id === a ? b : a;
    const retard = await accepter(perdant);
    check(
      "le perdant ne peut pas réécrire par-dessus",
      Array.isArray(retard.corps) ? retard.corps.length : -1,
      0,
    );
  }

  /* ═══ 2 · Perte de GPS ════════════════════════════════════════════════ */

  console.log(`\n${C.bold}Perte de GPS pendant une recherche${C.reset}`);

  await rest(`taxi_drivers?id=eq.${a}`, {
    method: "PATCH",
    body: JSON.stringify({ lat: null, lng: null, position_updated_at: null }),
  });

  const sansGps = await rest(`taxi_drivers?id=eq.${a}&select=status,is_available,lat,lng`);
  const fiche = Array.isArray(sansGps.corps) ? sansGps.corps[0] : null;

  /*
    La distinction que `taxi-presence.ts` défend, vérifiée en base.

    Perdre le GPS n'est pas se déclarer indisponible. Le chauffeur sort de la
    carte — il n'y a plus de point à y poser — mais reste dans la liste et
    reste appelable. Confondre les deux avait rendu invisibles des chauffeurs
    parfaitement libres.
  */
  check("le statut déclaré survit à la perte du GPS", fiche?.status, "libre");
  check("il reste marqué disponible", fiche?.is_available, true);
  check("mais il n'a plus de position à placer", fiche?.lat, null);

  /* ═══ 3 · Passage hors ligne ══════════════════════════════════════════ */

  console.log(`\n${C.bold}Passage hors ligne pendant une recherche${C.reset}`);

  // On lui rend une position, pour que seul le statut explique sa disparition.
  await rest(`taxi_drivers?id=eq.${a}`, {
    method: "PATCH",
    body: JSON.stringify({
      lat: GAFSA.lat, lng: GAFSA.lng,
      position_updated_at: new Date().toISOString(),
      status: "libre", is_available: true,
    }),
  });

  const avant = await rest(
    `taxi_drivers?is_approved=eq.true&status=eq.libre&id=in.(${a},${b})&select=id`,
  );
  check(
    "les deux chauffeurs sont candidats au matching",
    Array.isArray(avant.corps) ? avant.corps.length : -1,
    2,
  );

  await rest(`taxi_drivers?id=eq.${a}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "hors_ligne",
      status_since: new Date().toISOString(),
      is_available: false,
    }),
  });

  const apresOffline = await rest(
    `taxi_drivers?is_approved=eq.true&status=eq.libre&id=in.(${a},${b})&select=id`,
  );
  const restants = Array.isArray(apresOffline.corps) ? apresOffline.corps : [];

  check("le chauffeur hors ligne quitte le matching", restants.length, 1);
  check("et c'est bien l'autre qui reste", restants[0]?.id, b);

  /*
    La vue de la carte doit dire la même chose que le matching.

    Les deux avaient divergé : `offrirDemandes` filtrait sur « libre », la
    carte lisait `taxi_drivers` sans filtre et montrait les hors-ligne grisés.
    Un client voyait donc un taxi que le serveur n'aurait jamais contacté.
  */
  const vue = await rest(`taxi_chauffeurs_visibles?id=in.(${a},${b})&select=id`);
  if (vue.status === 404) {
    console.log(`  ${C.yellow}—  ${C.reset} vue taxi_chauffeurs_visibles absente (migration 20260907003000 non collée)`);
  } else {
    check(
      "la carte ne montre plus le hors-ligne",
      Array.isArray(vue.corps) ? vue.corps.length : -1,
      1,
    );
  }

  /* ─── Ménage ─────────────────────────────────────────────────────────── */

  await menage();

  if (ko > 0) {
    console.log(`\n${C.red}${C.bold}✗ ${ko} contrôle(s) en échec.${C.reset}\n`);
    process.exit(1);
  }

  console.log(`\n${C.green}${C.bold}✓ une course ne part jamais deux fois.${C.reset}\n`);
}

main().catch(async (cause) => {
  console.log(`\n${C.red}✗ ${cause?.message ?? cause}${C.reset}\n`);
  await menage().catch(() => {});
  process.exit(1);
});
