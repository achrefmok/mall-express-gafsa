"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireShopOwner } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { isOnAir, recentLiveVideos, subscribePage, unsubscribePage } from "@/lib/live/facebook-graph";

/**
 * Vérification manuelle des directs de la page.
 *
 * Le relais normal est poussé par Facebook (webhook). Ce bouton existe pour
 * deux situations : l'abonnement n'a pas pu être pris — les permissions
 * attendent encore la revue de Meta —, ou une notification s'est perdue. Il
 * fait exactement le même travail, mais à la demande.
 */
export async function refreshFacebookLives() {
  const { shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("shop_facebook_pages")
    .select("page_id, page_token")
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!link) return fail("Aucune page Facebook n'est reliée à cette boutique");

  try {
    const videos = await recentLiveVideos(link.page_id, link.page_token);
    let onAir = 0;

    for (const video of videos) {
      const live = isOnAir(video.status);
      if (live) onAir += 1;

      const { error: rpcError } = await admin.rpc("sync_facebook_live", {
        target_shop: shop.id,
        video_id: video.id,
        permalink: video.permalink,
        video_title: video.title,
        live_now: live,
      });

      if (rpcError) return fail(readableError(rpcError));
    }

    await admin
      .from("shop_facebook_pages")
      .update({ last_checked_at: new Date().toISOString(), last_error: null })
      .eq("shop_id", shop.id);

    revalidatePath("/vendeur/lives");
    revalidatePath("/vendeur/reglages");
    revalidatePath("/lives");

    return ok({ checked: videos.length, onAir });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue";

    await admin
      .from("shop_facebook_pages")
      .update({ last_checked_at: new Date().toISOString(), last_error: message.slice(0, 300) })
      .eq("shop_id", shop.id);

    return fail(
      /permission|scope|approved|OAuth/i.test(message)
        ? "Facebook refuse la lecture de la page. Les autorisations attendent la validation de Meta."
        : "Facebook n'a pas répondu. Réessayez dans un instant.",
    );
  }
}

/** Coupe le lien : plus aucune notification, et le jeton est effacé. */
export async function disconnectFacebookPage() {
  const { shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("shop_facebook_pages")
    .select("page_id, page_token")
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (link) {
    await unsubscribePage(link.page_id, link.page_token);
    await admin.from("shop_facebook_pages").delete().eq("shop_id", shop.id);
  }

  revalidatePath("/vendeur/reglages");
  return done();
}

/** Nouvel essai d'abonnement, une fois les permissions accordées par Meta. */
export async function retryFacebookSubscription() {
  const { shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("shop_facebook_pages")
    .select("page_id, page_token")
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!link) return fail("Aucune page Facebook n'est reliée à cette boutique");

  const subscribed = await subscribePage(link.page_id, link.page_token);

  await admin
    .from("shop_facebook_pages")
    .update({ is_subscribed: subscribed, updated_at: new Date().toISOString() })
    .eq("shop_id", shop.id);

  revalidatePath("/vendeur/reglages");

  return subscribed
    ? done()
    : fail("Facebook refuse encore l'abonnement. La détection automatique reste indisponible.");
}
