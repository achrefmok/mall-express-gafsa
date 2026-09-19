/**
 * La roue de la chance, éprouvée contre la vraie base.
 *
 *   npm run db:roue
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'on cherche à prouver
 * ────────────────────────────────────────────────────────────────────────
 *
 * Qu'on ne peut pas tricher. Le tirage vit dans `roue_tourner` : ce test ne
 * passe par aucun écran, il parle à PostgREST avec une vraie session — comme
 * le ferait quelqu'un qui a ouvert la console du navigateur.
 *
 * Quatre tentations, quatre refus attendus : jouer sans compte, rejouer
 * au-delà du quota, s'inscrire un tour gagnant à la main, lire les poids et
 * les stocks pour savoir s'il vaut la peine de jouer.
 *
 * Hors CI. En cas d'interruption :
 *   node scripts/clean-test-accounts.mjs @roue.mall-express.test
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

const DOMAINE = "@roue.mall-express.test";
const MDP = "roue-mall-express-2026";

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

const rpc = (nom, jeton, args = {}) =>
  fetch(`${BASE}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: {
      apikey: jeton === SERVICE ? SERVICE : ANON,
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  }).then(async (r) => ({ ok: r.ok, corps: await r.json().catch(() => null) }));

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
  for (const id of cree.boutiques) await rest(`shops?id=eq.${id}`, SERVICE, { method: "DELETE" });
  for (const id of cree.comptes) {
    await rest(`shops?owner_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H_SERVICE });
  }
}

async function main() {
  console.log(`\n${C.bold}Roue de la chance — contre la vraie base${C.reset}`);
  console.log(`${C.dim}${new URL(BASE).hostname}${C.reset}\n`);

  const sonde = await rest("shop_wheels?select=id&limit=1", SERVICE);
  if (!sonde.ok) {
    console.log(`${C.yellow}⚠ La migration de la roue n'est pas passée — contrôle ignoré.${C.reset}\n`);
    process.exit(0);
  }

  const marchand = await creerCompte("marchand", { first_name: "Marchand", role: "vendor" });
  const client = await creerCompte("client", { first_name: "Client", role: "client" });
  if (!marchand || !client) {
    console.log(`${C.red}Comptes de test impossibles à créer.${C.reset}`);
    process.exit(1);
  }
  cree.comptes.push(marchand, client);

  const jetonMarchand = await jetonDe("marchand");
  const jetonClient = await jetonDe("client");

  const boutique = await rest("shops?select=id,slug", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: marchand,
      slug: `essai-roue-${Date.now()}`,
      name: "Boutique à roue",
      status: "approved",
    }),
  });
  const shopId = boutique.corps?.[0]?.id;
  cree.boutiques.push(shopId);

  /* ─── 1 · Le commerçant compose sa roue ───────────────────────────── */
  console.log(`${C.bold}La composition${C.reset}`);

  const roue = await rest("shop_wheels?select=id", jetonMarchand, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ shop_id: shopId, title: "Roue d'essai", spins_per_day: 1 }),
  });
  check("le commerçant crée sa roue", roue.ok, true);
  const wheelId = roue.corps?.[0]?.id;

  const lots = await rest("wheel_prizes?select=id,label", jetonMarchand, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    /*
      Les mêmes clés partout : PostgREST refuse une insertion groupée dont
      les objets n ont pas la même forme (PGRST102). D où le `stock: null`
      explicite là où il n y a pas de limite.
    */
    body: JSON.stringify([
      { wheel_id: wheelId, label: "Perdu", weight: 0, is_win: false, stock: null, position: 0 },
      { wheel_id: wheelId, label: "Le seul lot", weight: 10, is_win: true, stock: 1, position: 1 },
      { wheel_id: wheelId, label: "Jamais tiré", weight: 0, is_win: true, stock: null, position: 2 },
    ]),
  });
  check("il ajoute ses lots", lots.ok, true);

  /* ─── 2 · Ce que le client peut voir ──────────────────────────────── */
  console.log(`\n${C.bold}Ce que le client voit${C.reset}`);

  const poids = await rest(`wheel_prizes?wheel_id=eq.${wheelId}&select=weight,stock`, jetonClient);
  check("il ne lit ni les poids ni les stocks", poids.corps?.length ?? 0, 0);

  /*
    La roue ne montre que ce qui peut sortir.

    Deux des trois cases sont à poids zéro : elles ne seront jamais tirées,
    et les dessiner ferait une roue qui ment — on peut s'arrêter dessus sans
    rien gagner. Le commerçant, lui, les garde sous les yeux : c'est à lui de
    leur redonner du poids.
  */
  const cases = await rpc("roue_lots_publics", jetonClient, { p_wheel: wheelId });
  check("il ne voit que la case tirable", cases.corps?.length, 1);
  check(
    "et rien d'autre que son libellé et sa photo",
    Object.keys(cases.corps?.[0] ?? {}).sort(),
    ["id", "image_url", "is_win", "label", "label_ar", "rang"],
  );

  const vuesDuComptoir = await rpc("roue_lots_publics", jetonMarchand, { p_wheel: wheelId });
  check("le commerçant voit les trois", vuesDuComptoir.corps?.length, 3);

  /* ─── 3 · Le tirage ───────────────────────────────────────────────── */
  console.log(`\n${C.bold}Le tirage${C.reset}`);

  const anonyme = await rpc("roue_tourner", null, { p_wheel: wheelId });
  check("sans compte, on ne tourne pas", anonyme.ok, false);

  const premier = await rpc("roue_tourner", jetonClient, { p_wheel: wheelId });
  check("le client tourne une fois", premier.ok, true);
  check(
    "et ne peut tomber que sur le lot de poids non nul",
    premier.corps?.[0]?.label,
    "Le seul lot",
  );

  const second = await rpc("roue_tourner", jetonClient, { p_wheel: wheelId });
  check("il ne rejoue pas le même jour", second.ok, false);
  check(
    "et le refus dit pourquoi",
    String(second.corps?.message ?? "").includes("ROUE_QUOTA"),
    true,
  );

  /* Le libellé contient des espaces : on filtre en mémoire plutôt que de
     bricoler un `eq.` que PostgREST interprète de travers. */
  const apresStock = await rest(`wheel_prizes?wheel_id=eq.${wheelId}&select=id,label,stock`, SERVICE);
  const leLot = (apresStock.corps ?? []).find((p) => p.label === "Le seul lot");
  check("le stock a été décrémenté", leLot?.stock, 0);

  /*
    Le cœur de « trois articles qui deviennent deux ».

    Le lot était à un exemplaire : gagné, il est épuisé, et sa case sort de
    la roue du client. Sans cela, la roue continuerait d'afficher un article
    qu'on ne peut plus gagner.
  */
  const apresLeTour = await rpc("roue_lots_publics", jetonClient, { p_wheel: wheelId });
  check("la case gagnée quitte la roue", apresLeTour.corps?.length, 0);

  const toujoursAuComptoir = await rpc("roue_lots_publics", jetonMarchand, { p_wheel: wheelId });
  check("le commerçant la garde, pour la réapprovisionner", toujoursAuComptoir.corps?.length, 3);

  /* ─── 4 · S'inscrire un tour à la main ────────────────────────────── */
  console.log(`\n${C.bold}La triche directe${C.reset}`);

  const fraude = await rest("wheel_spins", jetonClient, {
    method: "POST",
    body: JSON.stringify({ wheel_id: wheelId, user_id: client, code: "TRICHE" }),
  });
  check("un client n'inscrit pas son propre tour", fraude.ok, false);

  /* ─── 5 · Le lot épuisé sort de la roue ───────────────────────────── */
  console.log(`\n${C.bold}Une fois le stock épuisé${C.reset}`);

  await rest(`shop_wheels?id=eq.${wheelId}`, jetonMarchand, {
    method: "PATCH",
    body: JSON.stringify({ spins_per_day: 0 }),
  });

  const apresEpuisement = await rpc("roue_tourner", jetonClient, { p_wheel: wheelId });
  check("plus rien à tirer : la roue le dit", apresEpuisement.ok, false);
  check(
    "et ne rend pas un lot épuisé",
    String(apresEpuisement.corps?.message ?? "").includes("ROUE_VIDE"),
    true,
  );

  /* ─── 6 · Roue fermée ─────────────────────────────────────────────── */
  console.log(`\n${C.bold}Roue fermée${C.reset}`);

  /*
    On redonne du poids à la case perdante avant de couper la roue : sinon le
    refus qui suit pourrait venir d'une roue vide plutôt que d'une roue
    fermée, et le contrôle ne prouverait pas ce qu'il annonce.
  */
  const perdu = (apresStock.corps ?? []).find((p) => p.label === "Perdu");
  if (perdu) {
    await rest(`wheel_prizes?id=eq.${perdu.id}`, jetonMarchand, {
      method: "PATCH",
      body: JSON.stringify({ weight: 5 }),
    });
  }

  await rest(`shop_wheels?id=eq.${wheelId}`, jetonMarchand, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });

  const fermee = await rpc("roue_tourner", jetonClient, { p_wheel: wheelId });
  check("une roue coupée ne tourne plus", fermee.ok, false);

  const invisible = await rest(`shop_wheels?id=eq.${wheelId}&select=id`, jetonClient);
  check("et disparaît de la fiche", invisible.corps?.length, 0);

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
