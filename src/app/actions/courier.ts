"use server";

import { revalidatePath } from "next/cache";
import { fail, done, readableError, requireProfile } from "./_helpers";

/**
 * Fait avancer une commande en livraison au nom du livreur désigné
 * (voir `is_courier()` / `app_settings.courier_shop_id`).
 *
 * Pas de vérification de rôle ici : c'est la policy RLS `orders_courier_update`
 * qui autorise ou non l'écriture. Si l'appelant n'est pas le livreur, ou si
 * la commande n'est plus au statut de départ attendu, l'update ne touche
 * aucune ligne — PostgREST renvoie quand même un succès, donc c'est
 * `data === null` après le `select` qui signale le refus, pas `error`.
 */
export async function advanceDeliveryOrder(orderId: string, from: "ready" | "shipped") {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const target = from === "ready" ? "shipped" : "delivered";

  const { data, error: e } = await supabase
    .from("orders")
    .update({ status: target })
    .eq("id", orderId)
    .eq("status", from)
    .eq("delivery_method", "delivery")
    .select("id")
    .maybeSingle();

  if (e) return fail(readableError(e));
  if (!data) return fail("Commande introuvable ou déjà mise à jour");

  revalidatePath("/vendeur/livraisons");
  revalidatePath("/vendeur/commandes");
  revalidatePath("/commandes");
  return done();
}
