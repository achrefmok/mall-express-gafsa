"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile, requireShopOwner } from "./_helpers";

/**
 * La roue de la chance d'une boutique.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce fichier ne tire jamais au sort
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le lot est choisi par `roue_tourner`, en base, sous verrou. Ni le
 * navigateur ni ce serveur d'application ne décident : l'un se ferait
 * démonter par qui sait ouvrir une console, l'autre se ferait contourner par
 * qui parle à PostgREST directement. Une roue truquable, une fois connue, ne
 * vaut plus rien — ni pour le commerçant qui paie les lots, ni pour les
 * clients honnêtes.
 *
 * Ce qui est ici : mettre en forme, traduire les refus, rafraîchir.
 */

const MESSAGES: Record<string, string> = {
  ROUE_CONNEXION: "Connectez-vous pour tourner la roue",
  ROUE_FERMEE: "Cette roue n'est plus ouverte",
  ROUE_QUOTA: "Vous avez déjà joué aujourd'hui. Revenez demain.",
  ROUE_VIDE: "Tous les lots ont été distribués",
};

/** Tourner. Le résultat vient de la base, l'animation s'y arrête. */
export async function tournerLaRoue(wheelId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data, error: e } = await supabase.rpc("roue_tourner", { p_wheel: wheelId });

  if (e) {
    const connu = Object.keys(MESSAGES).find((cle) => e.message.includes(cle));
    return fail(connu ? MESSAGES[connu] : readableError(e));
  }

  const resultat = Array.isArray(data) ? data[0] : null;
  if (!resultat) return fail("La roue n'a rien rendu");

  return ok(resultat);
}

/* ─── Côté commerçant ─────────────────────────────────────────────────── */

export async function enregistrerRoue(input: {
  title?: string;
  titleAr?: string;
  isActive?: boolean;
  spinsPerDay?: number;
  endsAt?: string | null;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const corps = {
    shop_id: shop.id,
    title: input.title?.trim() || "Roue de la chance",
    title_ar: input.titleAr?.trim() || null,
    is_active: input.isActive ?? true,
    spins_per_day: Math.min(Math.max(Math.round(input.spinsPerDay ?? 1), 0), 20),
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
  };

  /*
    Une roue par boutique : `upsert` sur `shop_id`, qui est unique. Créer et
    modifier sont ainsi le même geste, et le commerçant qui revient sur son
    écran ne s'en fabrique pas une seconde.
  */
  const { data, error: e } = await supabase
    .from("shop_wheels")
    .upsert(corps, { onConflict: "shop_id" })
    .select("id")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/roue");
  revalidatePath(`/boutique/${shop.slug}`);
  revalidatePath("/accueil");
  return ok({ id: data.id });
}

export async function enregistrerLot(input: {
  id?: string;
  wheelId: string;
  label: string;
  labelAr?: string;
  weight: number;
  isWin: boolean;
  stock?: number | null;
  position?: number;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const libelle = input.label.trim();
  if (libelle.length < 2) return fail("Nommez le lot");

  const corps = {
    wheel_id: input.wheelId,
    label: libelle,
    label_ar: input.labelAr?.trim() || null,
    weight: Math.min(Math.max(Math.round(input.weight), 0), 10_000),
    is_win: input.isWin,
    stock: input.stock == null ? null : Math.max(Math.round(input.stock), 0),
    position: input.position ?? 0,
  };

  const { error: e } = input.id
    ? await supabase.from("wheel_prizes").update(corps).eq("id", input.id)
    : await supabase.from("wheel_prizes").insert(corps);

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/roue");
  revalidatePath(`/boutique/${shop.slug}`);
  return done();
}

export async function supprimerLot(id: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: e } = await supabase.from("wheel_prizes").delete().eq("id", id);
  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/roue");
  return done();
}

/** Le lot a été remis au comptoir. */
export async function marquerLotRemis(spinId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e, count } = await supabase
    .from("wheel_spins")
    .update({ claimed_at: new Date().toISOString(), claimed_by: profile.id }, { count: "exact" })
    .eq("id", spinId)
    .is("claimed_at", null);

  if (e) return fail(readableError(e));
  // Zéro ligne : la policy a filtré, ou le lot était déjà remis.
  if (count === 0) return fail("Ce lot a déjà été remis");

  revalidatePath("/vendeur/roue");
  return done();
}
