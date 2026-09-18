/**
 * Lelma3ardh et le rôle `dahmani_admin`, éprouvés contre la vraie base.
 *
 *   npm run db:lelma3ardh
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'on cherche à prouver
 * ────────────────────────────────────────────────────────────────────────
 *
 * Qu'un administrateur Dahmani peut tenir son exposition, et **rien d'autre**.
 * Cacher les écrans ne prouve rien : ce test ne passe par aucun écran. Il
 * ouvre une session avec son mot de passe et parle à PostgREST directement,
 * exactement comme le ferait quelqu'un qui aurait lu le code du client.
 *
 * Les refus attendus sont donc aussi importants que les réussites : boutiques,
 * chauffeurs, membres, réglages, partenaires, modération du Free Shop.
 *
 * Hors CI. En cas d'interruption :
 *   node scripts/clean-test-accounts.mjs @lelma3ardh.mall-express.test
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

const DOMAINE = "@lelma3ardh.mall-express.test";
const MDP = "lelma3ardh-mall-express-2026";

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

const cree = { comptes: [], expos: [], boutiques: [] };

async function menage() {
  for (const id of cree.expos) await rest(`expos?id=eq.${id}`, SERVICE, { method: "DELETE" });
  for (const id of cree.boutiques) await rest(`shops?id=eq.${id}`, SERVICE, { method: "DELETE" });
  for (const id of cree.comptes) {
    await rest(`shops?owner_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H_SERVICE });
  }
}

async function main() {
  console.log(`\n${C.bold}Lelma3ardh — contre la vraie base${C.reset}`);
  console.log(`${C.dim}${new URL(BASE).hostname}${C.reset}\n`);

  const sonde = await rest("expos?select=id&limit=1", SERVICE);
  if (!sonde.ok) {
    console.log(`${C.yellow}⚠ La migration Lelma3ardh n'est pas passée — contrôle ignoré.${C.reset}\n`);
    process.exit(0);
  }

  const dahmani = await creerCompte("dahmani", { first_name: "Dahmani" });
  const quidam = await creerCompte("quidam", { first_name: "Quidam" });
  if (!dahmani || !quidam) {
    console.log(`${C.red}Comptes de test impossibles à créer.${C.reset}`);
    process.exit(1);
  }
  cree.comptes.push(dahmani, quidam);

  await rest(`profiles?id=eq.${dahmani}`, SERVICE, {
    method: "PATCH",
    body: JSON.stringify({ role: "dahmani_admin" }),
  });

  const jetonDahmani = await jetonDe("dahmani");
  const jetonQuidam = await jetonDe("quidam");

  /* Une boutique ordinaire, pour voir s'il peut y toucher. */
  const boutique = await rest("shops?select=id", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: quidam,
      slug: `essai-cloison-${Date.now()}`,
      name: "Boutique d'un autre",
      status: "approved",
    }),
  });
  const idBoutique = boutique.corps?.[0]?.id;
  cree.boutiques.push(idBoutique);

  /* ─── 1 · Ce qu'il peut faire ─────────────────────────────────────── */
  console.log(`${C.bold}Son périmètre${C.reset}`);

  const expo = await rest("expos?select=id", jetonDahmani, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      slug: `essai-expo-${Date.now()}`,
      name: "Édition d'essai",
      starts_on: "2026-10-01",
      ends_on: "2026-10-05",
    }),
  });
  check("il crée une édition", expo.ok, true);
  const idExpo = expo.corps?.[0]?.id;
  if (idExpo) cree.expos.push(idExpo);

  const exposant = await rest("expo_exhibitors?select=id", jetonDahmani, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ expo_id: idExpo, slug: `essai-stand-${Date.now()}`, name: "Stand d'essai" }),
  });
  check("il crée un exposant", exposant.ok, true);
  const idExposant = exposant.corps?.[0]?.id;

  const produit = await rest("expo_products?select=id", jetonDahmani, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ exhibitor_id: idExposant, name: "Produit d'essai", price: 20 }),
  });
  check("il ajoute un produit", produit.ok, true);

  const approbation = await rest(`expo_exhibitors?id=eq.${idExposant}`, jetonDahmani, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved" }),
  });
  check("il approuve son exposant", approbation.ok, true);

  const suppression = await rest(`expo_products?id=eq.${produit.corps?.[0]?.id}`, jetonDahmani, {
    method: "DELETE",
  });
  check("il supprime un produit", suppression.ok, true);

  /* ─── 2 · Ce qu'il ne peut pas ────────────────────────────────────── */
  console.log(`\n${C.bold}Ce qui lui est fermé${C.reset}`);

  await rest(`shops?id=eq.${idBoutique}`, jetonDahmani, {
    method: "PATCH",
    body: JSON.stringify({ name: "Détournée", is_partner: true }),
  });
  const boutiqueApres = await rest(`shops?id=eq.${idBoutique}&select=name,is_partner`, SERVICE);
  check("il ne renomme pas une boutique", boutiqueApres.corps?.[0]?.name, "Boutique d'un autre");
  check("il ne fait pas un partenaire", boutiqueApres.corps?.[0]?.is_partner, false);

  await rest(`profiles?id=eq.${quidam}`, jetonDahmani, {
    method: "PATCH",
    body: JSON.stringify({ role: "admin" }),
  });
  const quidamApres = await rest(`profiles?id=eq.${quidam}&select=role`, SERVICE);
  check("il ne promeut personne administrateur", quidamApres.corps?.[0]?.role, "client");

  /*
    Une écriture vide passe partout : PostgREST la traite comme une requête
    sans effet. Le contrôle porte donc sur une vraie modification, et sur
    ce que la base a gardé après.
  */
  const avantLogo = await rest("app_brand?id=eq.true&select=app_logo_url", SERVICE);
  await rest("app_brand?id=eq.true", jetonDahmani, {
    method: "PATCH",
    body: JSON.stringify({ app_logo_url: "https://intrus.test/logo.png" }),
  });
  const apresLogo = await rest("app_brand?id=eq.true&select=app_logo_url", SERVICE);
  check(
    "il ne change pas le logo de l'application",
    apresLogo.corps?.[0]?.app_logo_url,
    avantLogo.corps?.[0]?.app_logo_url,
  );

  const chauffeurs = await rest("taxi_drivers?select=id&limit=1", jetonDahmani, {
    method: "PATCH",
    body: JSON.stringify({ is_approved: true }),
  });
  check("il n'approuve pas un chauffeur", chauffeurs.ok, false);

  const moderation = await fetch(`${BASE}/rest/v1/rpc/freeshop_moderer`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jetonDahmani}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_deal: "00000000-0000-0000-0000-000000000000", p_decision: "approved" }),
  });
  check("il ne modère pas le Free Shop", moderation.ok, false);

  /* ─── 3 · Et un membre ordinaire ? ────────────────────────────────── */
  console.log(`\n${C.bold}Un membre ordinaire${C.reset}`);

  const parQuidam = await rest("expos?select=id", jetonQuidam, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ slug: `intrus-${Date.now()}`, name: "Intrus", starts_on: "2026-10-01", ends_on: "2026-10-02" }),
  });
  check("ne crée pas d'édition", parQuidam.ok, false);

  const exposantParQuidam = await rest("expo_exhibitors?select=id", jetonQuidam, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ expo_id: idExpo, slug: `intrus-${Date.now()}`, name: "Intrus" }),
  });
  check("ne crée pas d'exposant", exposantParQuidam.ok, false);

  /* ─── 4 · Ce que voit le public ───────────────────────────────────── */
  console.log(`\n${C.bold}Le public${C.reset}`);

  const anonyme = await fetch(`${BASE}/rest/v1/expo_exhibitors?id=eq.${idExposant}&select=id`, {
    headers: { apikey: ANON },
  }).then((r) => r.json());
  check("un stand approuvé est visible sans compte", anonyme?.length, 1);

  await rest(`expos?id=eq.${idExpo}`, jetonDahmani, {
    method: "PATCH",
    body: JSON.stringify({ is_published: false }),
  });
  const apresMasquage = await fetch(`${BASE}/rest/v1/expo_exhibitors?id=eq.${idExposant}&select=id`, {
    headers: { apikey: ANON },
  }).then((r) => r.json());
  check("l'édition masquée cache ses stands", apresMasquage?.length, 0);

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
