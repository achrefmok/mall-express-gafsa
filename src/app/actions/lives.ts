"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile, requireShopOwner } from "./_helpers";
import { upsertProduct } from "./vendor";
import { checkFacebookEmbeddable, resolveFacebookLiveUrl } from "@/lib/live/facebook";
import { isTiktokUrl, resolveTiktokLiveUrl } from "@/lib/live/tiktok";
import type { LiveSource } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════════════
   Actions « lives ».
   La vidéo elle-même ne passe pas par ici : en source `camera` les flux
   circulent en pair-à-pair (WebRTC), en source `facebook` c'est Facebook qui
   sert la vidéo, en source `tiktok` le spectateur la regarde dans TikTok.
   Ce module gère la couche commerce et l'état du direct.
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

/**
 * Signale une arrivée (`delta: 1`) ou un départ (`delta: -1`) du direct.
 *
 * Remplace l'ancien `reportViewerCount`, qui rapportait la taille du canal
 * Presence de ce client — fiable, mais qui exigeait une connexion Realtime
 * ouverte par spectateur pendant tout le direct. Le compteur est maintenant
 * tenu à jour par ces deux appels, silencieux comme le précédent : un
 * spectateur anonyme ne compte pas, ce n'était déjà pas le cas avant.
 */
export async function bumpLiveViewers(liveId: string, delta: 1 | -1) {
  const { supabase, profile } = await requireProfile();
  if (!profile) return done();

  await supabase.rpc("bump_live_viewers", { target_live: liveId, delta });
  return done();
}

/**
 * Un sondage, à la place du canal Realtime.
 *
 * Renvoie en un aller-retour ce que l'écran de direct doit rafraîchir
 * toutes les quelques secondes : l'état du direct (spectateurs, mentions
 * « j'aime », produit épinglé, achats) et les commentaires arrivés depuis
 * le dernier sondage. Une requête au lieu de deux, et surtout : aucune
 * connexion tenue ouverte entre deux appels.
 */
export async function pollLive(liveId: string, sinceIso: string) {
  // `requireProfile` rend toujours un client — connecté ou non, la lecture
  // d'un direct et de ses commentaires reste publique.
  const { supabase } = await requireProfile();

  const [{ data: live }, { data: comments }] = await Promise.all([
    supabase
      .from("lives")
      .select("status, likes_count, pinned_product_id, viewers_count, purchases_count")
      .eq("id", liveId)
      .maybeSingle(),
    supabase
      .from("live_comments")
      .select("id, body, created_at, author:profiles(first_name, last_name)")
      .eq("live_id", liveId)
      .eq("is_hidden", false)
      .gt("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(60),
  ]);

  return ok({ live, comments: comments ?? [] });
}

/* ─── Côté vendeur ─────────────────────────────────────────────────────── */

export async function createLive(input: {
  title: string;
  titleAr?: string;
  source: LiveSource;
  facebookUrl?: string;
  hlsUrl?: string;
  tiktokUrl?: string;
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
    const checked = await resolveFacebookLiveUrl(input.facebookUrl);
    if (!checked.ok) return fail(checked.error);

    // Le refus se dit ici, pendant la préparation, et pas devant les clients.
    const embed = await checkFacebookEmbeddable(checked.url);
    if (!embed.embeddable) return fail(embed.error);

    facebookUrl = checked.url;
  }

  let tiktokUrl: string | null = null;

  if (input.source === "tiktok") {
    if (!input.tiktokUrl?.trim()) return fail("Collez le lien de votre direct TikTok");
    const checked = await resolveTiktokLiveUrl(input.tiktokUrl);
    if (!checked.ok) return fail(checked.error);
    tiktokUrl = checked.url;
  }

  if (input.source === "hls" && !input.hlsUrl?.trim().endsWith(".m3u8")) {
    return fail("L'URL du flux doit se terminer par .m3u8");
  }

  const debutPrevu = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
  if (Number.isNaN(debutPrevu.getTime())) return fail("Date de rendez-vous invalide");

  const { data, error: insertError } = await supabase
    .from("lives")
    .insert({
      shop_id: shop.id,
      title,
      title_ar: input.titleAr?.trim() || null,
      source: input.source,
      facebook_url: facebookUrl,
      hls_url: input.source === "hls" ? input.hlsUrl!.trim() : null,
      // Absente du payload hors TikTok : un direct Facebook ou caméra reste
      // possible tant que la migration TikTok n'est pas collée.
      ...(tiktokUrl ? { tiktok_url: tiktokUrl } : {}),
      pinned_product_id: input.pinnedProductId || null,
      live_percent_off: input.percentOff && input.percentOff > 0 ? input.percentOff : null,
      /*
        L'offre court à partir du direct, pas de sa création.

        Comptée depuis maintenant, une offre de dix minutes posée sur un
        direct programmé dans deux heures était éteinte avant l'ouverture
        de l'antenne : le commerçant annonçait une remise que personne ne
        pouvait prendre.
      */
      offer_ends_at: input.offerMinutes
        ? new Date(debutPrevu.getTime() + input.offerMinutes * 60_000).toISOString()
        : null,
      scheduled_at: debutPrevu.toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();

  if (insertError) return fail(liveInsertError(insertError));

  revalidatePath("/vendeur/lives");
  return ok({ id: data.id });
}

/*
  Source `tiktok` sans la migration `live_source_tiktok` : la base refuse la
  valeur d'énumération (22P02) ou ne connaît pas la colonne (PGRST204). Le
  message générique ne dirait pas au commerçant que le reste fonctionne.
*/
function liveInsertError(error: { message: string; code?: string }) {
  if (error.code === "22P02" || error.code === "PGRST204") {
    return "Les directs TikTok ne sont pas encore activés sur G-Mall. Choisissez une autre source pour l'instant.";
  }
  return readableError(error);
}

/**
 * Crée un direct Facebook ou TikTok et le passe à l'antenne d'un seul geste.
 *
 * Sert le partage depuis le système : le commerçant diffuse sur Facebook ou
 * sur TikTok, touche « Partager », choisit G-Mall — et le direct est en ligne
 * ici, avec sa couche commerce. Rien à saisir. La plateforme se lit sur le
 * lien lui-même.
 *
 * Le produit épinglé et la remise sont reportés du direct précédent : c'est
 * presque toujours la même boutique qui vend la même chose, et ce sont deux
 * champs de moins à remplir dans l'urgence d'une diffusion qui a commencé.
 */
export async function relaySharedLive(input: { url: string; title?: string }) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  if (shop.status !== "approved") {
    return fail("Votre boutique doit être approuvée avant de diffuser");
  }

  const tiktok = isTiktokUrl(input.url);
  let url: string;

  if (tiktok) {
    const checked = await resolveTiktokLiveUrl(input.url);
    if (!checked.ok) return fail(checked.error);
    url = checked.url;
  } else {
    const checked = await resolveFacebookLiveUrl(input.url);
    if (!checked.ok) return fail(checked.error);

    const embed = await checkFacebookEmbeddable(checked.url);
    if (!embed.embeddable) return fail(embed.error);
    url = checked.url;
  }

  /*
    Déjà relayé — on y renvoie au lieu d'ouvrir un doublon.

    Pour Facebook, le lien désigne une vidéo : le retrouver, c'est retrouver
    le même direct. Pour TikTok, il désigne le compte, identique d'un direct à
    l'autre : on ne reprend donc qu'un direct encore ouvert, sans quoi le
    direct de ce soir rouvrirait celui de la semaine dernière, avec son titre
    et ses compteurs.
  */
  let existingQuery = supabase
    .from("lives")
    .select("id")
    .eq("shop_id", shop.id)
    .eq(tiktok ? "tiktok_url" : "facebook_url", url);
  if (tiktok) existingQuery = existingQuery.in("status", ["scheduled", "live"]);

  const { data: existing } = await existingQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.rpc("start_live", { target_live: existing.id, peer: null });
    revalidatePath("/lives");
    return ok({ id: existing.id, reused: true });
  }

  const { data: previous } = await supabase
    .from("lives")
    .select("pinned_product_id, live_percent_off")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error: insertError } = await supabase
    .from("lives")
    .insert({
      shop_id: shop.id,
      title: input.title?.trim() || `Direct de ${shop.name}`,
      ...(tiktok
        ? { source: "tiktok" as const, tiktok_url: url }
        : { source: "facebook" as const, facebook_url: url }),
      pinned_product_id: previous?.pinned_product_id ?? null,
      live_percent_off: previous?.live_percent_off ?? null,
      scheduled_at: new Date().toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();

  if (insertError) return fail(liveInsertError(insertError));

  const { error: startError } = await supabase.rpc("start_live", {
    target_live: created.id,
    peer: null,
  });

  if (startError) return fail(readableError(startError));

  revalidatePath("/lives");
  revalidatePath("/accueil");
  revalidatePath("/vendeur/lives");

  return ok({ id: created.id, reused: false });
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

/* ═══════════════════════════════════════════════════════════════════════
   Les articles présentés pendant le direct
   ═══════════════════════════════════════════════════════════════════════

   `lives.pinned_product_id` désigne l'article dont on parle à l'instant ;
   `live_products` porte la liste complète, ordonnée par le vendeur. Les deux
   coexistent : l'un met en avant, l'autre laisse acheter le reste sans quitter
   l'écran.

   La policy de la table vérifie déjà que l'article appartient à la boutique qui
   diffuse. On ne la double pas ici : une vérification recopiée finit par diverger
   de celle qui fait autorité. */

export async function addProductToLive(liveId: string, productId: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  // Placé en fin de liste : le vendeur ajoute au fil de sa présentation.
  const { data: last } = await supabase
    .from("live_products")
    .select("position")
    .eq("live_id", liveId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await supabase
    .from("live_products")
    .insert({ live_id: liveId, product_id: productId, position: (last?.position ?? -1) + 1 });

  // 23505 = déjà présent dans ce direct : l'intention est satisfaite.
  if (insertError && insertError.code !== "23505") return fail(readableError(insertError));

  revalidatePath(`/lives/${liveId}`);
  return done();
}

export async function removeProductFromLive(liveId: string, productId: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: deleteError } = await supabase
    .from("live_products")
    .delete()
    .eq("live_id", liveId)
    .eq("product_id", productId);

  if (deleteError) return fail(readableError(deleteError));

  revalidatePath(`/lives/${liveId}`);
  return done();
}

/**
 * Créer un article et le présenter, d'un seul geste.
 *
 * Le chemin rapide du vendeur en pleine diffusion : il photographie ce qu'il
 * tient, saisit un nom et un prix, et l'article devient achetable pendant qu'il
 * en parle. Passer par le formulaire produit complet demanderait de quitter la
 * console, donc d'interrompre le direct.
 *
 * La création délègue à `upsertProduct` : mêmes contrôles, même plafond de cinq
 * articles avant approbation de la boutique. Recopier ces règles ici les aurait
 * laissées diverger au premier changement.
 *
 * Le stock vaut 1 par défaut — un vendeur qui filme une pièce en main en a
 * généralement une seule. Il reste modifiable depuis la fiche produit.
 *
 * `description` n'est pas rempli : le brancher sur une extraction automatique
 * depuis la photo se fera ici, sans toucher au reste de la chaîne.
 */
export async function quickAddProductToLive(input: {
  liveId: string;
  name: string;
  price: number;
  stock?: number;
  images?: string[];
  pin?: boolean;
}) {
  const created = await upsertProduct({
    name: input.name,
    price: input.price,
    stock: input.stock ?? 1,
    images: input.images ?? [],
  });
  if (!created.ok) return created;

  const linked = await addProductToLive(input.liveId, created.data.id);
  if (!linked.ok) return linked;

  // Épinglé par défaut : on vient d'en parler, c'est celui qu'on regarde.
  if (input.pin !== false) await updatePinnedProduct(input.liveId, created.data.id);

  return ok({ id: created.data.id });
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
