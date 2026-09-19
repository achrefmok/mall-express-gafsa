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
  imageUrl?: string | null;
  productId?: string | null;
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
    image_url: input.imageUrl ?? null,
    product_id: input.productId ?? null,
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

/**
 * Les trois façons d'ajouter une case, en un geste.
 *
 * ────────────────────────────────────────────────────────────────────
 * Pourquoi des raccourcis plutôt qu'un formulaire
 * ────────────────────────────────────────────────────────────────────
 *
 * Composer six cases à la main, c'est six fois : écrire un libellé,
 * choisir un poids, décider d'un stock, dire si c'est gagnant. La plupart
 * des commerçants abandonnent à la troisième — et ceux qui finissent ont
 * écrit des noms qui ne correspondent à rien de leur catalogue.
 *
 * Les valeurs par défaut ci-dessous ne sont pas arbitraires :
 *
 *   · un produit part à un exemplaire et au poids 5. Un article offert est
 *     ce qui coûte le plus cher au commerçant : il doit sortir rarement, et
 *     la case disparaît une fois gagnée — c'est ce qu'on veut de « trois
 *     articles » qui deviennent « deux articles » ;
 *   · une remise part au poids 20 et sans stock : elle ne coûte que sur
 *     une vente, et il n'y a aucune raison de la limiter ;
 *   · une case perdante part au poids 40. Deux d'entre elles suffisent à
 *     faire d'une distribution un jeu.
 *
 * Tout reste modifiable ensuite. Ce sont des points de départ, pas des
 * règles.
 */
export async function ajouterCase(input: {
  wheelId: string;
  kind: "produit" | "remise" | "perdu" | "photo";
  position: number;
  /** Pour « produit ». */
  productId?: string;
  productName?: string;
  productImage?: string | null;
  /** Pour « remise ». */
  percent?: number;
  /** Pour « photo ». */
  label?: string;
  imageUrl?: string | null;
}) {
  const { shop } = await requireShopOwner();
  if (!shop) return fail("Boutique introuvable");

  if (input.kind === "produit") {
    if (!input.productId || !input.productName) return fail("Choisissez un produit");
    return enregistrerLot({
      wheelId: input.wheelId,
      label: input.productName,
      weight: 5,
      isWin: true,
      stock: 1,
      imageUrl: input.productImage ?? null,
      productId: input.productId,
      position: input.position,
    });
  }

  if (input.kind === "remise") {
    const pourcent = Math.min(Math.max(Math.round(input.percent ?? 10), 1), 90);
    return enregistrerLot({
      wheelId: input.wheelId,
      label: `−${pourcent} % sur le panier`,
      labelAr: `‏−${pourcent}٪ على السلّة`,
      weight: 20,
      isWin: true,
      stock: null,
      position: input.position,
    });
  }

  if (input.kind === "photo") {
    const libelle = input.label?.trim();
    if (!libelle) return fail("Nommez le lot");
    return enregistrerLot({
      wheelId: input.wheelId,
      label: libelle,
      weight: 5,
      isWin: true,
      stock: 1,
      imageUrl: input.imageUrl ?? null,
      position: input.position,
    });
  }

  return enregistrerLot({
    wheelId: input.wheelId,
    label: "Perdu, retentez demain",
    labelAr: "حظّ أوفر غدًا",
    weight: 40,
    isWin: false,
    stock: null,
    position: input.position,
  });
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
