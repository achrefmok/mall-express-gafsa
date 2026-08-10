"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile, requireShopOwner } from "./_helpers";
import { normalizeFacebookLiveUrl } from "@/lib/live/facebook";
import type { LiveSource } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════════════
   Actions « lives ».
   La vidéo elle-même ne passe pas par ici : en source `camera` les flux
   circulent en pair-à-pair (WebRTC), en source `facebook` c'est Facebook qui
   sert la vidéo. Ce module gère la couche commerce et l'état du direct.
   ═══════════════════════════════════════════════════════════════════════ */

export async function followShopOfLive(liveId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data: live } = await supabase.from("lives").select("shop_id").eq("id", liveId).single();
  if (!live) return fail("Direct introuvable");

  const { error: insertError } = await supabase
    .from("shop_follows")
    .insert({ user_id: profile.id, shop_id: live.shop_id });

  // 23505 = déjà abonné : l'intention de l'utilisateur est satisfaite.
  if (insertError && insertError.code !== "23505") return fail(readableError(insertError));

  revalidatePath("/");
  return done();
}

export async function postLiveComment(liveId: string, body: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const text = body.trim();
  if (!text) return fail("Commentaire vide");
  if (text.length > 500) return fail("Commentaire trop long");

  const { error: insertError } = await supabase
    .from("live_comments")
    .insert({ live_id: liveId, user_id: profile.id, body: text });

  if (insertError) return fail(readableError(insertError));
  return done();
}

export async function toggleLiveLike(liveId: string, liked: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (liked) {
    const { error: e } = await supabase.from("live_likes").delete().match({
      live_id: liveId,
      user_id: profile.id,
    });
    if (e) return fail(readableError(e));
  } else {
    const { error: e } = await supabase
      .from("live_likes")
      .insert({ live_id: liveId, user_id: profile.id });
    if (e && e.code !== "23505") return fail(readableError(e));
  }

  return done();
}

/** Remontée du compteur de spectateurs depuis le canal Presence. */
export async function reportViewerCount(liveId: string, count: number) {
  const { supabase, profile } = await requireProfile();
  if (!profile) return done(); // silencieux : ce n'est qu'un compteur

  await supabase.rpc("set_live_viewers", { target_live: liveId, count_now: count });
  return done();
}

/* ─── Côté vendeur ─────────────────────────────────────────────────────── */

export async function createLive(input: {
  title: string;
  titleAr?: string;
  source: LiveSource;
  facebookUrl?: string;
  hlsUrl?: string;
  pinnedProductId?: string;
  percentOff?: number;
  offerMinutes?: number;
  scheduledAt?: string;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  if (shop.status !== "approved") {
    return fail("Votre boutique doit être approuvée avant de diffuser");
  }

  const title = input.title.trim();
  if (!title) return fail("Le titre est obligatoire");

  let facebookUrl: string | null = null;

  if (input.source === "facebook") {
    if (!input.facebookUrl?.trim()) {
      return fail("Collez le lien du direct de votre page Facebook");
    }
    const checked = normalizeFacebookLiveUrl(input.facebookUrl);
    if (!checked.ok) return fail(checked.error);
    facebookUrl = checked.url;
  }

  if (input.source === "hls" && !input.hlsUrl?.trim().endsWith(".m3u8")) {
    return fail("L'URL du flux doit se terminer par .m3u8");
  }

  const { data, error: insertError } = await supabase
    .from("lives")
    .insert({
      shop_id: shop.id,
      title,
      title_ar: input.titleAr?.trim() || null,
      source: input.source,
      facebook_url: facebookUrl,
      hls_url: input.source === "hls" ? input.hlsUrl!.trim() : null,
      pinned_product_id: input.pinnedProductId || null,
      live_percent_off: input.percentOff && input.percentOff > 0 ? input.percentOff : null,
      offer_ends_at: input.offerMinutes
        ? new Date(Date.now() + input.offerMinutes * 60_000).toISOString()
        : null,
      scheduled_at: input.scheduledAt || new Date().toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();

  if (insertError) return fail(readableError(insertError));

  revalidatePath("/vendeur/lives");
  return ok({ id: data.id });
}

/**
 * Passe le direct à l'antenne. `peerId` n'est transmis qu'en source caméra :
 * c'est l'identifiant sur lequel les spectateurs adressent leur offre WebRTC.
 */
export async function startLive(liveId: string, peerId?: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { data, error: rpcError } = await supabase.rpc("start_live", {
    target_live: liveId,
    peer: peerId ?? null,
  });

  if (rpcError) return fail(readableError(rpcError));

  revalidatePath("/lives");
  revalidatePath("/");
  return ok(data);
}

export async function endLive(liveId: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: rpcError } = await supabase.rpc("end_live", { target_live: liveId });
  if (rpcError) return fail(readableError(rpcError));

  revalidatePath("/lives");
  revalidatePath("/vendeur/lives");
  return done();
}

export async function updatePinnedProduct(liveId: string, productId: string | null) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: updateError } = await supabase
    .from("lives")
    .update({ pinned_product_id: productId })
    .eq("id", liveId)
    .eq("shop_id", shop.id);

  if (updateError) return fail(readableError(updateError));
  return done();
}

export async function hideLiveComment(commentId: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: updateError } = await supabase
    .from("live_comments")
    .update({ is_hidden: true })
    .eq("id", commentId);

  if (updateError) return fail(readableError(updateError));
  return done();
}
