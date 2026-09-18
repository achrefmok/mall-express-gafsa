/**
 * Free Shop, éprouvé contre la vraie base.
 *
 *   npm run db:free-shop
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi contre la base, et avec de vraies sessions
 * ────────────────────────────────────────────────────────────────────────
 *
 * Aucune des deux limites ne vit dans le code TypeScript. Les quatre photos
 * sont une contrainte de table, les trois publications par mois un
 * déclencheur, la visibilité une policy. Un test qui simulerait la base ne
 * prouverait que la qualité du simulacre — et c'est précisément ce qu'on
 * cherche à démontrer ici : qu'un membre qui parle à PostgREST directement,
 * sans passer par le formulaire, se heurte aux mêmes murs.
 *
 * Les écritures passent donc par **la session du membre** — un vrai jeton
 * obtenu par mot de passe — et non par la clé de service, qui traverse les
 * policies et est d'ailleurs exemptée du quota par conception (reprises,
 * imports).
 *
 * Hors CI, comme `db:smoke` : il écrit dans une vraie base. Tout est créé
 * puis effacé ; en cas d'interruption :
 *   node scripts/clean-test-accounts.mjs @free-shop.mall-express.test
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

const DOMAINE = "@free-shop.mall-express.test";
const MDP = "free-shop-mall-express-2026";

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

const cree = { comptes: [], annonces: [] };

async function menage() {
  for (const id of cree.annonces) await rest(`deals?id=eq.${id}`, SERVICE, { method: "DELETE" });
  for (const id of cree.comptes) {
    await rest(`deals?author_id=eq.${id}`, SERVICE, { method: "DELETE" });
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H_SERVICE });
  }
}

/** Une annonce, publiée par le membre lui-même. */
async function publier(jeton, auteur, { titre, photos = [] }) {
  const demain = new Date(Date.now() + 86_400_000).toISOString();
  const r = await rest("deals?select=id,moderation", jeton, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ author_id: auteur, title: titre, expires_at: demain, images: photos }),
  });
  const id = Array.isArray(r.corps) ? r.corps[0]?.id : null;
  if (id) cree.annonces.push(id);
  return { ...r, id };
}

async function main() {
  console.log(`\n${C.bold}Free Shop — contre la vraie base${C.reset}`);
  console.log(`${C.dim}${new URL(BASE).hostname}${C.reset}\n`);

  const sonde = await rest("deals?select=moderation&limit=1", SERVICE);
  if (!sonde.ok) {
    console.log(`${C.yellow}⚠ La migration Free Shop n'est pas passée — contrôle ignoré.${C.reset}\n`);
    process.exit(0);
  }

  const membre = await creerCompte("membre", { first_name: "Membre", role: "client" });
  const voisin = await creerCompte("voisin", { first_name: "Voisin", role: "client" });
  const arbitre = await creerCompte("arbitre", { first_name: "Arbitre", role: "client" });
  if (!membre || !voisin || !arbitre) {
    console.log(`${C.red}Comptes de test impossibles à créer.${C.reset}`);
    process.exit(1);
  }
  cree.comptes.push(membre, voisin, arbitre);

  /*
    L'arbitre est fait administrateur en base, puis ouvre sa propre session.
    La modération est éprouvée par le chemin réel — un jeton d'administrateur
    appelant `freeshop_moderer` — et non par la clé de service : celle-ci
    n'est pas `is_admin()`, et le garde-fou des privilèges lui refuserait
    l'écriture. Ce qu'on veut prouver, c'est que l'écran d'administration
    fonctionne, pas qu'une clé secrète peut tout.
  */
  await rest(`profiles?id=eq.${arbitre}`, SERVICE, {
    method: "PATCH",
    body: JSON.stringify({ role: "admin" }),
  });

  const jetonMembre = await jetonDe("membre");
  const jetonVoisin = await jetonDe("voisin");
  const jetonArbitre = await jetonDe("arbitre");

  /** La décision, telle que l'écran d'administration la prend. */
  const moderer = (deal, decision, motif = null) =>
    fetch(`${BASE}/rest/v1/rpc/freeshop_moderer`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${jetonArbitre}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_deal: deal, p_decision: decision, p_motif: motif }),
    });

  /* ─── 1 · Quatre photos, pas cinq ─────────────────────────────────── */
  console.log(`${C.bold}Les photos${C.reset}`);

  const quatre = ["a", "b", "c", "d"].map((n) => `https://exemple.test/${n}.jpg`);
  const avecQuatre = await publier(jetonMembre, membre, { titre: "Quatre photos", photos: quatre });
  check("quatre photos passent", avecQuatre.ok, true);

  const avecCinq = await publier(jetonMembre, membre, {
    titre: "Cinq photos",
    photos: [...quatre, "https://exemple.test/e.jpg"],
  });
  check("la cinquième est refusée par la base", avecCinq.ok, false);
  check(
    "et refusée par la contrainte, pas par autre chose",
    String(avecCinq.corps?.message ?? "").includes("deals_quatre_photos"),
    true,
  );

  /* ─── 2 · Trois publications par mois ─────────────────────────────── */
  console.log(`\n${C.bold}Le quota du mois${C.reset}`);

  const deux = await publier(jetonMembre, membre, { titre: "Deuxième" });
  const trois = await publier(jetonMembre, membre, { titre: "Troisième" });
  check("la deuxième passe", deux.ok, true);
  check("la troisième passe", trois.ok, true);

  const quatrieme = await publier(jetonMembre, membre, { titre: "Quatrième" });
  check("la quatrième est refusée", quatrieme.ok, false);
  check(
    "et refusée par le déclencheur du quota",
    String(quatrieme.corps?.message ?? "").includes("FREESHOP_LIMITE_MOIS"),
    true,
  );

  const quota = await fetch(`${BASE}/rest/v1/rpc/freeshop_quota`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jetonMembre}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.json());
  check("le compteur annoncé vaut ce que la base compte", quota?.[0], { utilisees: 3, plafond: 3 });

  /* ─── 3 · Un refus ne mange pas le quota ──────────────────────────── */
  console.log(`\n${C.bold}Après un refus${C.reset}`);

  const sansMotif = await moderer(trois.id, "rejected");
  check("un refus sans motif est refusé", sansMotif.ok, false);

  const refus = await moderer(trois.id, "rejected", "Photos illisibles");
  check("un refus motivé passe", refus.ok, true);

  const apresRefus = await publier(jetonMembre, membre, { titre: "Après un refus" });
  check("la place libérée par un refus est rendue", apresRefus.ok, true);

  /* ─── 4 · Rien n'est public avant décision ────────────────────────── */
  console.log(`\n${C.bold}La visibilité${C.reset}`);

  const vueParLAuteur = await rest(`deals?id=eq.${deux.id}&select=id`, jetonMembre);
  check("l'auteur voit son annonce en attente", vueParLAuteur.corps?.length, 1);

  const vueParLeVoisin = await rest(`deals?id=eq.${deux.id}&select=id`, jetonVoisin);
  check("personne d'autre ne la voit", vueParLeVoisin.corps?.length, 0);

  await moderer(deux.id, "approved");

  const apresApprobation = await rest(`deals?id=eq.${deux.id}&select=id`, jetonVoisin);
  check("approuvée, elle devient publique", apresApprobation.corps?.length, 1);

  /* ─── 5 · L'auteur ne s'approuve pas lui-même ─────────────────────── */
  console.log(`\n${C.bold}La modération${C.reset}`);

  await rest(`deals?id=eq.${avecQuatre.id}`, jetonMembre, {
    method: "PATCH",
    body: JSON.stringify({ moderation: "approved" }),
  });
  const apresTentative = await rest(`deals?id=eq.${avecQuatre.id}&select=moderation`, SERVICE);
  check("un auteur ne s'approuve pas lui-même", apresTentative.corps?.[0]?.moderation, "pending");

  const parLeVoisin = await fetch(`${BASE}/rest/v1/rpc/freeshop_moderer`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jetonVoisin}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_deal: avecQuatre.id, p_decision: "approved" }),
  });
  check("et un membre ordinaire ne modère pas", parLeVoisin.ok, false);

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
