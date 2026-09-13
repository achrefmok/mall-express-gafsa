/**
 * Le Black Friday, éprouvé contre la vraie base.
 *
 *   npm run db:black-friday
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi contre la base, et avec de vraies sessions
 * ────────────────────────────────────────────────────────────────────────
 *
 * Aucune des garanties du Black Friday ne vit dans le code TypeScript. La
 * fenêtre est calculée par un déclencheur, la visibilité par une policy, le
 * refus d'un prix plus élevé par un autre déclencheur, et le prix payé par
 * `place_order`. Un test qui simulerait la base ne prouverait que la qualité
 * du simulacre.
 *
 * Les écritures des commerçants et la commande du client passent donc par
 * **leur propre session** — un vrai jeton obtenu par mot de passe — et non
 * par la clé de service, qui traverse les policies et ne prouverait rien.
 * C'est la différence avec `db:concurrence`, qui créait sa demande en
 * service_role et le disait.
 *
 * Hors CI, comme `db:smoke` : il écrit dans une vraie base. Tout est créé
 * puis effacé ; en cas d'interruption :
 *   node scripts/clean-test-accounts.mjs @black-friday.mall-express.test
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = { reset: "[0m", bold: "[1m", dim: "[2m", red: "[31m", green: "[32m", yellow: "[33m" };

let ko = 0;
const check = (nom, reel, attendu) => {
  const ok = JSON.stringify(reel) === JSON.stringify(attendu);
  if (!ok) ko++;
  console.log(
    `  ${ok ? `${C.green}ok ${C.reset}` : `${C.red}KO ${C.reset}`} ${nom}` +
      (ok ? "" : `\n       obtenu ${JSON.stringify(reel)}\n       attendu ${JSON.stringify(attendu)}`),
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

const BASE = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BASE || !SERVICE || !ANON) {
  console.log(`\n${C.yellow}⚠ Variables Supabase absentes — contrôle ignoré (hors CI par conception).${C.reset}\n`);
  process.exit(0);
}

const DOMAINE = "@black-friday.mall-express.test";
const MDP = "black-friday-mall-express-2026";

/** Une requête PostgREST, avec le jeton donné. */
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

/* ─── Le décor ────────────────────────────────────────────────────────── */

const cree = { comptes: [], produits: [], campagne: null, commandes: [] };

async function menage() {
  for (const id of cree.commandes) await rest(`orders?id=eq.${id}`, SERVICE, { method: "DELETE" });
  if (cree.campagne) await rest(`black_friday_campaigns?id=eq.${cree.campagne}`, SERVICE, { method: "DELETE" });
  for (const id of cree.produits) await rest(`products?id=eq.${id}`, SERVICE, { method: "DELETE" });
  for (const id of cree.comptes) {
    await rest(`orders?user_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await rest(`shops?owner_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H_SERVICE });
  }
}

/** Un vendredi lointain, pour ne jamais heurter une vraie campagne. */
function vendrediLointain() {
  const d = new Date(Date.UTC(2099, 0, 1));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log(`\n${C.bold}Black Friday — contre la vraie base${C.reset}`);
  console.log(`${C.dim}${new URL(BASE).hostname}${C.reset}\n`);

  // La migration est-elle là ?
  const sonde = await rest("black_friday_campaigns?select=id&limit=1", SERVICE);
  if (sonde.status === 404 || sonde.corps?.code === "PGRST205" || sonde.corps?.code === "42P01") {
    console.log(`${C.yellow}— migration 20260913001000_black_friday.sql non appliquée : rien à éprouver.${C.reset}\n`);
    process.exit(0);
  }

  /* Deux commerçants, un client. */
  const vendeurA = await creerCompte("vendeur-a", { role: "vendor", first_name: "Vendeur A", shop_name: "Boutique BF A", shop_location: "Test" });
  const vendeurB = await creerCompte("vendeur-b", { role: "vendor", first_name: "Vendeur B", shop_name: "Boutique BF B", shop_location: "Test" });
  const client = await creerCompte("client", { first_name: "Client BF" });

  if (!vendeurA || !vendeurB || !client) {
    console.log(`${C.red}✗ Les comptes de test n'ont pas pu être créés.${C.reset}\n`);
    await menage();
    process.exit(1);
  }
  cree.comptes.push(vendeurA, vendeurB, client);

  // Les boutiques naissent « pending » : la clé de service les approuve.
  await rest(`shops?owner_id=in.(${vendeurA},${vendeurB})`, SERVICE, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved" }),
  });
  const boutiques = await rest(`shops?owner_id=in.(${vendeurA},${vendeurB})&select=id,owner_id`, SERVICE);
  const shopA = boutiques.corps.find((s) => s.owner_id === vendeurA)?.id;

  const produit = await rest("products", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ shop_id: shopA, name: "Chaussures test BF", price: 250, stock: 5 }),
  });
  const produitId = produit.corps?.[0]?.id;
  cree.produits.push(produitId);

  const [jA, jB, jClient] = await Promise.all([jetonDe("vendeur-a"), jetonDe("vendeur-b"), jetonDe("client")]);

  /* ═══ 1 · La fenêtre ══════════════════════════════════════════════════ */
  console.log(`${C.bold}La fenêtre de 24 heures${C.reset}`);

  const vendredi = vendrediLointain();
  const camp = await rest("black_friday_campaigns", SERVICE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    // starts_at / ends_at provisoires : le déclencheur les écrase.
    body: JSON.stringify({ friday_date: vendredi, starts_at: "2000-01-01T00:00:00Z", ends_at: "2000-01-02T00:00:00Z" }),
  });
  const campagne = camp.corps?.[0];
  cree.campagne = campagne?.id ?? null;

  const attenduDebut = new Date(Date.parse(`${vendredi}T00:00:00Z`) - 59 * 60_000).toISOString();
  check("commence le vendredi à 00:01 heure de Tunis", new Date(campagne?.starts_at).toISOString(), attenduDebut);
  check(
    "dure exactement 24 heures",
    Date.parse(campagne?.ends_at) - Date.parse(campagne?.starts_at),
    24 * 3600 * 1000,
  );

  const jeudi = await rest("black_friday_campaigns", SERVICE, {
    method: "POST",
    body: JSON.stringify({ friday_date: "2099-01-01", starts_at: "2000-01-01T00:00:00Z", ends_at: "2000-01-02T00:00:00Z" }),
  });
  check("un jeudi est refusé", jeudi.ok, false);

  /* ═══ 2 · Les règles du commerçant ════════════════════════════════════ */
  console.log(`\n${C.bold}Les règles du commerçant${C.reset}`);

  const tropCher = await rest("black_friday_offers", jA, {
    method: "POST",
    body: JSON.stringify({ campaign_id: campagne.id, product_id: produitId, shop_id: shopA, bf_price: 300, is_enabled: true }),
  });
  check("un prix Black Friday supérieur au prix normal est refusé", tropCher.ok, false);

  const intrus = await rest("black_friday_offers", jB, {
    method: "POST",
    body: JSON.stringify({ campaign_id: campagne.id, product_id: produitId, shop_id: shopA, bf_price: 100, is_enabled: true }),
  });
  check("un autre commerçant ne peut pas créer d'offre sur ce produit", intrus.ok, false);

  const offre = await rest("black_friday_offers", jA, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ campaign_id: campagne.id, product_id: produitId, shop_id: shopA, bf_price: 179, is_enabled: true }),
  });
  const offreId = offre.corps?.[0]?.id;
  check("le propriétaire crée son offre à 179 DT", Boolean(offreId), true);

  const auto = await rest(`black_friday_offers?id=eq.${offreId}`, jA, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ is_moderated: false, shares_count: 9999 }),
  });
  check("le commerçant ne peut pas gonfler son compteur de partages", auto.corps?.[0]?.shares_count, 0);

  /* ═══ 3 · Avant la campagne ═══════════════════════════════════════════ */
  console.log(`\n${C.bold}Avant 00:01${C.reset}`);

  const avantPublic = await rest(`black_friday_offers?id=eq.${offreId}&select=id`, ANON);
  check("le public ne voit pas l'offre avant l'ouverture", avantPublic.corps?.length ?? -1, 0);

  const avantVendeur = await rest(`black_friday_offers?id=eq.${offreId}&select=id`, jA);
  check("le commerçant voit son offre programmée", avantVendeur.corps?.length ?? -1, 1);

  /* ═══ 4 · Pendant : on déplace la fenêtre sur maintenant ══════════════ */
  console.log(`\n${C.bold}Pendant la campagne${C.reset}`);

  await rest(`black_friday_campaigns?id=eq.${campagne.id}`, SERVICE, {
    method: "PATCH",
    body: JSON.stringify({
      starts_at: new Date(Date.now() - 3600_000).toISOString(),
      ends_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
  });

  const pendantPublic = await rest(`black_friday_offers?id=eq.${offreId}&select=id,bf_price`, ANON);
  check("le public voit l'offre pendant la fenêtre", pendantPublic.corps?.length ?? -1, 1);

  const etat = await rest("rpc/black_friday_etat", ANON, { method: "POST", body: "{}" });
  check("l'état rend l'heure du serveur", typeof etat.corps?.now, "string");

  /*
    Le cœur du test : ce que le client paie.

    Commande passée avec la session du client, par la vraie fonction. Le
    prix n'est pas transmis — il ne l'est jamais — et doit sortir à 179.
  */
  const commande = await rest("rpc/place_order", jClient, {
    method: "POST",
    body: JSON.stringify({
      p_shop_id: shopA,
      p_items: [{ product_id: produitId, quantity: 1 }],
      p_contact_phone: "20123456",
      p_delivery_method: "pickup",
    }),
  });
  if (commande.corps?.id) cree.commandes.push(commande.corps.id);

  check("place_order facture le prix Black Friday", Number(commande.corps?.total), 179);

  const lignes = await rest(`order_items?order_id=eq.${commande.corps?.id}&select=unit_price`, SERVICE);
  check("la ligne de commande garde le prix payé", Number(lignes.corps?.[0]?.unit_price), 179);

  /* ═══ 5 · Après la fin ════════════════════════════════════════════════ */
  console.log(`\n${C.bold}Après 00:01 le samedi${C.reset}`);

  await rest(`black_friday_campaigns?id=eq.${campagne.id}`, SERVICE, {
    method: "PATCH",
    body: JSON.stringify({
      starts_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      ends_at: new Date(Date.now() - 60_000).toISOString(),
    }),
  });

  const apresPublic = await rest(`black_friday_offers?id=eq.${offreId}&select=id`, ANON);
  check("le public ne voit plus l'offre", apresPublic.corps?.length ?? -1, 0);

  const modif = await rest(`black_friday_offers?id=eq.${offreId}`, jA, {
    method: "PATCH",
    body: JSON.stringify({ bf_price: 150 }),
  });
  check("le commerçant ne peut plus modifier son offre", modif.ok, false);

  const suppr = await rest(`black_friday_offers?id=eq.${offreId}`, jA, { method: "DELETE" });
  const encore = await rest(`black_friday_offers?id=eq.${offreId}&select=id`, SERVICE);
  check("ni la supprimer", (encore.corps?.length ?? 0) === 1 && !suppr.ok, true);

  const commande2 = await rest("rpc/place_order", jClient, {
    method: "POST",
    body: JSON.stringify({
      p_shop_id: shopA,
      p_items: [{ product_id: produitId, quantity: 1 }],
      p_contact_phone: "20123456",
      p_delivery_method: "pickup",
    }),
  });
  if (commande2.corps?.id) cree.commandes.push(commande2.corps.id);
  check("après la fin, place_order revient au prix normal", Number(commande2.corps?.total), 250);

  await menage();

  if (ko > 0) {
    console.log(`\n${C.red}${C.bold}✗ ${ko} contrôle(s) en échec.${C.reset}\n`);
    process.exit(1);
  }
  console.log(`\n${C.green}${C.bold}✓ le prix affiché est le prix payé, et pas une minute de plus.${C.reset}\n`);
}

main().catch(async (cause) => {
  console.log(`\n${C.red}✗ ${cause?.message ?? cause}${C.reset}\n`);
  await menage().catch(() => {});
  process.exit(1);
});
