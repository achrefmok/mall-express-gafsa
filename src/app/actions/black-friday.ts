"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, requireAdmin, requireShopOwner } from "./_helpers";
import { createClient } from "@/lib/supabase/server";
import { estVendredi } from "@/lib/black-friday";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";

type T = Awaited<ReturnType<typeof getT>>["t"];

/* ═══════════════════════════════════════════════════════════════════════
   Les gestes du Black Friday.

   Ces actions ne sont pas la barrière. Elles valident pour donner un message
   lisible tout de suite — « le prix doit être inférieur » plutôt qu'une
   erreur de base — mais chaque règle est **aussi** posée côté Postgres :
   policy de lecture, déclencheur `black_friday_garde`, `place_order`. Un
   commerçant qui appellerait PostgREST en direct, sans passer par ici,
   rencontrerait exactement les mêmes refus.
   ═══════════════════════════════════════════════════════════════════════ */

const MIGRATION_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

/*
  Les exceptions du déclencheur `black_friday_garde` sont rédigées en
  français et remontent telles quelles (P0001) : ce sont des refus rares —
  écrire après la fin, sur le produit d'un autre — qu'un écran normal ne
  provoque pas, puisqu'il les prévient avant. Tout le reste passe par le
  dictionnaire.
*/
function messageBase(t: T, error: { code?: string; message: string }, repli: string): string {
  if (error.code && MIGRATION_ABSENTE.includes(error.code)) return t.bfVendor.notEnabled;
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return t.bfVendor.errDuplicate;
  return repli;
}

function rafraichir() {
  revalidatePath("/vendeur/black-friday");
  revalidatePath("/black-friday");
  revalidatePath("/accueil");
}

/**
 * La campagne à laquelle rattacher une nouvelle offre : celle en cours, sinon
 * la prochaine. Jamais une campagne terminée — la base le refuserait de toute
 * façon, mais autant le dire avant.
 */
async function campagneOuverte(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("black_friday_etat");
  if (error) return { campagne: null, error };

  const c = data?.campagne ?? null;
  if (!c || c.phase === "termine") return { campagne: null, error: null };
  return { campagne: c, error: null };
}

/* ─── Côté commerçant ─────────────────────────────────────────────────── */

/**
 * Ajouter un produit au Black Friday, ou changer son prix.
 *
 * Le prix est arrondi au millime — la subdivision du dinar, et la précision
 * de la colonne. Un prix saisi « 179,4999 » ne doit pas devenir une valeur
 * que personne n'a choisie.
 */
export async function enregistrerOffre(input: {
  productId: string;
  prixBf: number;
  active: boolean;
}) {
  const { t } = await getT();
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const prix = Math.round(Number(input.prixBf) * 1000) / 1000;
  if (!Number.isFinite(prix) || prix <= 0) return fail(t.bfVendor.errPrice);

  const { data: produit } = await supabase
    .from("products")
    .select("id, price, shop_id")
    .eq("id", input.productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!produit) return fail(t.bfVendor.errNotYours);
  if (prix >= Number(produit.price)) {
    return fail(format(t.bfVendor.errLower, { price: produit.price }));
  }

  const { campagne, error: etatError } = await campagneOuverte(supabase);
  if (etatError) return fail(messageBase(t, etatError, t.bfVendor.errRead));
  if (!campagne) return fail(t.bfVendor.errNoCampaign);

  const { error: writeError } = await supabase.from("black_friday_offers").upsert(
    {
      campaign_id: campagne.id,
      product_id: produit.id,
      shop_id: shop.id,
      bf_price: prix,
      is_enabled: input.active,
    },
    { onConflict: "campaign_id,product_id" },
  );

  if (writeError) return fail(messageBase(t, writeError, t.bfVendor.errSave));

  rafraichir();
  return done();
}

export async function basculerOffre(offreId: string, active: boolean) {
  const { t } = await getT();
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: writeError } = await supabase
    .from("black_friday_offers")
    .update({ is_enabled: active })
    .eq("id", offreId)
    .eq("shop_id", shop.id);

  if (writeError) return fail(messageBase(t, writeError, t.bfVendor.errUpdate));

  rafraichir();
  return done();
}

export async function retirerOffre(offreId: string) {
  const { t } = await getT();
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: writeError } = await supabase
    .from("black_friday_offers")
    .delete()
    .eq("id", offreId)
    .eq("shop_id", shop.id);

  if (writeError) return fail(messageBase(t, writeError, t.bfVendor.errRemove));

  rafraichir();
  return done();
}

/* ─── Côté administration ─────────────────────────────────────────────── */

/**
 * Programmer une campagne sur un vendredi.
 *
 * La fenêtre n'est pas transmise : le déclencheur la calcule depuis la date.
 * Laisser l'administration saisir l'heure de début, c'était laisser la
 * possibilité d'une campagne de vingt-trois heures par une faute de frappe.
 */
export async function creerCampagne(fridayDate: string) {
  const { t } = await getT();
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fridayDate) || !estVendredi(fridayDate)) {
    return fail(t.bfAdmin.errFriday);
  }

  // Les colonnes calculées sont renseignées par le déclencheur ; on passe des
  // valeurs provisoires pour satisfaire le type, elles sont écrasées.
  const { error: writeError } = await supabase.from("black_friday_campaigns").insert({
    friday_date: fridayDate,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 1000).toISOString(),
    created_by: profile.id,
  });

  if (writeError) {
    return fail(
      writeError.code === "23505"
        ? t.bfAdmin.errExists
        : messageBase(t, writeError, t.bfAdmin.errCreate),
    );
  }

  revalidatePath("/admin/black-friday");
  rafraichir();
  return done();
}

/** L'interrupteur global : une campagne désactivée n'existe plus pour personne. */
export async function basculerCampagne(id: string, active: boolean) {
  const { t } = await getT();
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("black_friday_campaigns")
    .update({ is_enabled: active })
    .eq("id", id);

  if (writeError) return fail(messageBase(t, writeError, t.bfAdmin.errUpdate));

  revalidatePath("/admin/black-friday");
  rafraichir();
  return done();
}

/**
 * Retirer une offre sans la supprimer.
 *
 * La trace reste — le commerçant voit son offre « retirée par
 * l'administration », avec la raison. Une suppression l'aurait fait
 * disparaître sans explication, et il l'aurait recréée.
 */
export async function modererOffre(id: string, moderee: boolean, note?: string) {
  const { t } = await getT();
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("black_friday_offers")
    .update({ is_moderated: moderee, moderation_note: moderee ? note?.trim() || null : null })
    .eq("id", id);

  if (writeError) return fail(messageBase(t, writeError, t.bfAdmin.errModeration));

  revalidatePath("/admin/black-friday");
  rafraichir();
  return done();
}

/* ─── Côté visiteur ───────────────────────────────────────────────────── */

/** Compter un partage. Silencieuse : un partage non compté ne gêne personne. */
export async function compterPartage(offreId: string) {
  const supabase = await createClient();
  await supabase.rpc("black_friday_partage", { p_offre: offreId });
  return ok(true);
}
