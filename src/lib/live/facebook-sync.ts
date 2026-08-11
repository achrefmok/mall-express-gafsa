import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isOnAir, recentLiveVideos } from "./facebook-graph";

type Admin = SupabaseClient<Database>;

export type PageLink = { shop_id: string; page_id: string; page_token: string };

export type SyncResult = {
  shopId: string;
  checked: number;
  onAir: number;
  error?: string;
};

/**
 * Met le site à jour d'après l'état réel des directs d'une page.
 *
 * Un seul chemin de code pour les trois déclencheurs — la vérification
 * planifiée, le bouton « Vérifier maintenant » du vendeur, et le webhook
 * quand il est disponible. Trois copies auraient divergé.
 *
 * `sync_facebook_live` est idempotente : rejouer une vérification ne crée pas
 * de doublon et ne renotifie personne.
 */
export async function syncPage(admin: Admin, link: PageLink): Promise<SyncResult> {
  const now = new Date().toISOString();

  try {
    const videos = await recentLiveVideos(link.page_id, link.page_token);
    let onAir = 0;

    for (const video of videos) {
      const live = isOnAir(video.status);
      if (live) onAir += 1;

      const { error } = await admin.rpc("sync_facebook_live", {
        target_shop: link.shop_id,
        video_id: video.id,
        permalink: video.permalink,
        video_title: video.title,
        live_now: live,
      });

      if (error) throw new Error(error.message);
    }

    await admin
      .from("shop_facebook_pages")
      .update({ last_checked_at: now, last_error: null })
      .eq("shop_id", link.shop_id);

    return { shopId: link.shop_id, checked: videos.length, onAir };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue";

    // La trace reste visible par le vendeur dans ses réglages : un jeton
    // révoqué ou une permission retirée doit se voir, pas se deviner.
    await admin
      .from("shop_facebook_pages")
      .update({ last_checked_at: now, last_error: message.slice(0, 300) })
      .eq("shop_id", link.shop_id);

    return { shopId: link.shop_id, checked: 0, onAir: 0, error: message };
  }
}

/** Message présentable pour le vendeur, à partir de l'erreur brute de Facebook. */
export function readableGraphError(message: string): string {
  if (/permission|scope|approved|OAuth|token/i.test(message)) {
    return "Facebook refuse la lecture de la page. Reconnectez-la, ou attendez la validation des autorisations par Meta.";
  }
  return "Facebook n'a pas répondu. Réessayez dans un instant.";
}
