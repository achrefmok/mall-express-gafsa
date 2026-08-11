"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, requireShopOwner } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { subscribePage, unsubscribePage, WEBHOOK_ENABLED } from "@/lib/live/facebook-graph";
import { readableGraphError, syncPage } from "@/lib/live/facebook-sync";

/** Le lien de la boutique courante, jeton compris. Serveur uniquement. */
async function currentLink() {
  const { shop, error } = await requireShopOwner();
  if (!shop) return { link: null, shopId: null, error } as const;

  const admin = createAdminClient();
  const { data } = await admin
    .from("shop_facebook_pages")
    .select("shop_id, page_id, page_token")
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!data) {
    return {
      link: null,
      shopId: shop.id,
      error: "Aucune page Facebook n'est reliée à cette boutique",
    } as const;
  }

  return { link: data, shopId: shop.id, error: null, admin } as const;
}

/**
 * Vérification à la demande.
 *
 * Le relais tourne déjà tout seul — vérification planifiée toutes les quinze
 * minutes, ou webhook quand l'application y a droit. Ce bouton sert au vendeur
 * qui vient de lancer son direct et ne veut pas attendre le prochain passage.
 */
export async function refreshFacebookLives() {
  const { link, error, admin } = await currentLink();
  if (!link || !admin) return fail(error!);

  const result = await syncPage(admin, link);
  if (result.error) return fail(readableGraphError(result.error));

  revalidatePath("/vendeur/lives");
  revalidatePath("/vendeur/reglages");
  revalidatePath("/lives");
  revalidatePath("/accueil");

  return ok({ checked: result.checked, onAir: result.onAir });
}

/** Coupe le lien : plus aucune synchronisation, et le jeton est effacé. */
export async function disconnectFacebookPage() {
  const { link, shopId, error, admin } = await currentLink();
  if (!shopId) return fail(error!);

  if (link && admin) {
    await unsubscribePage(link.page_id, link.page_token);
    await admin.from("shop_facebook_pages").delete().eq("shop_id", shopId);
  }

  revalidatePath("/vendeur/reglages");
  return done();
}

/**
 * Nouvel essai d'abonnement au webhook.
 *
 * N'a de sens que si l'application Meta a obtenu `pages_manage_metadata` et que
 * `FACEBOOK_ENABLE_WEBHOOK=1` est posé — sinon la permission n'a même pas été
 * demandée au commerçant, et Facebook refusera.
 */
export async function retryFacebookSubscription() {
  if (!WEBHOOK_ENABLED) {
    return fail(
      "La détection poussée n'est pas activée sur ce site. La vérification planifiée assure déjà le relais.",
    );
  }

  const { link, shopId, error, admin } = await currentLink();
  if (!link || !admin) return fail(error!);

  const subscribed = await subscribePage(link.page_id, link.page_token);

  await admin
    .from("shop_facebook_pages")
    .update({ is_subscribed: subscribed, updated_at: new Date().toISOString() })
    .eq("shop_id", shopId!);

  revalidatePath("/vendeur/reglages");

  return subscribed
    ? done()
    : fail("Facebook refuse l'abonnement. La vérification planifiée reste en place.");
}
