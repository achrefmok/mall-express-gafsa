"use server";

import { revalidatePath } from "next/cache";
import { done, fail, readableError, requireProfile } from "./_helpers";

/* ═══════════════════════════════════════════════════════════════════════
   Les avis sur un produit.

   La table existait déjà, avec sa colonne `product_id`, et personne n'écrivait
   jamais dedans : le seul endroit qui la lisait comptait les avis d'un membre
   sur son profil. Les fiches produit n'affichaient que la note de la boutique —
   celle d'un vendeur qui vend cent articles ne dit rien de l'article qu'on
   regarde.
   ═══════════════════════════════════════════════════════════════════════ */

export async function laisserAvis(input: {
  productId: string;
  note: number;
  commentaire?: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const note = Math.round(Number(input.note));
  if (!Number.isFinite(note) || note < 1 || note > 5) return fail("Note invalide");

  const commentaire = input.commentaire?.trim() ?? "";
  if (commentaire.length > 600) return fail("Commentaire trop long");

  const { data: produit, error: lectureError } = await supabase
    .from("products")
    .select("id, shop_id")
    .eq("id", input.productId)
    .maybeSingle();

  if (lectureError) return fail(readableError(lectureError));
  if (!produit) return fail("Produit introuvable");

  /*
    Seul quelqu'un qui a acheté peut noter.

    C'est la condition qui sépare un avis d'une opinion. Sans elle, une note
    ne coûte rien à produire : un concurrent en dépose cinq mauvaises, un
    vendeur s'en offre dix bonnes, et la moyenne cesse d'apprendre quoi que ce
    soit à qui que ce soit — auquel cas il valait mieux ne rien afficher.

    L'achat se vérifie sur les lignes de commande, pas sur la commande : c'est
    le produit qui est noté, et une commande peut en contenir dix.
  */
  const { data: achat } = await supabase
    .from("order_items")
    .select("id, order:orders!inner(user_id, status)")
    .eq("product_id", input.productId)
    .eq("order.user_id", profile.id)
    .neq("order.status", "cancelled")
    .limit(1)
    .maybeSingle();

  if (!achat) {
    return fail("Vous pourrez donner votre avis après avoir reçu ce produit.");
  }

  /*
    Un avis par personne et par produit.

    On réécrit le précédent plutôt que d'en empiler un second : quelqu'un qui
    change d'opinion corrige son avis, il n'en publie pas deux contradictoires.
    Le trigger de la base tient la moyenne de la boutique à jour de son côté.
  */
  const { data: existant } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", profile.id)
    .eq("product_id", input.productId)
    .maybeSingle();

  const { error: writeError } = existant
    ? await supabase
        .from("reviews")
        .update({ rating: note, body: commentaire || null })
        .eq("id", existant.id)
    : await supabase.from("reviews").insert({
        user_id: profile.id,
        shop_id: produit.shop_id,
        product_id: input.productId,
        rating: note,
        body: commentaire || null,
      });

  if (writeError) return fail(readableError(writeError));

  revalidatePath(`/produit/${input.productId}`);
  return done();
}

/** Retirer son propre avis. La policy empêche déjà de toucher celui d'un autre. */
export async function retirerAvis(productId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("reviews")
    .delete()
    .eq("user_id", profile.id)
    .eq("product_id", productId);

  if (writeError) return fail(readableError(writeError));

  revalidatePath(`/produit/${productId}`);
  return done();
}
