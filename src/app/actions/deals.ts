"use server";

import { revalidatePath } from "next/cache";
import { FREESHOP_PAR_MOIS, FREESHOP_PHOTOS_MAX } from "@/lib/free-shop";
import { done, fail, ok, readableError, requireAdmin, requireProfile } from "./_helpers";

/**
 * Publier sur Free Shop.
 *
 * Les deux limites — quatre photos, trois publications par mois — sont
 * posées en base. Ce qui est vérifié ici l'est pour la forme du message,
 * pas pour la sécurité : un formulaire se contourne, un déclencheur non.
 */
export async function createDeal(input: {
  title: string;
  body?: string;
  bodyAr?: string;
  images?: string[];
  shopId?: string;
  categoryId?: string;
  locationLabel?: string;
  price?: number | null;
  phone?: string;
  whatsapp?: string;
  expiresAt: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const title = input.title.trim();
  if (title.length < 3) return fail("Le titre doit faire au moins 3 caractères");

  const expires = new Date(input.expiresAt);
  if (Number.isNaN(expires.getTime())) return fail("Date de validité invalide");
  if (expires.getTime() <= Date.now()) return fail("La date de validité doit être dans le futur");

  const images = (input.images ?? []).slice(0, FREESHOP_PHOTOS_MAX);

  const prix = input.price ?? null;
  if (prix !== null && (!Number.isFinite(prix) || prix < 0)) return fail("Prix invalide");

  const { data, error: insertError } = await supabase
    .from("deals")
    .insert({
      author_id: profile.id,
      title,
      body: input.body?.trim() || null,
      body_ar: input.bodyAr?.trim() || null,
      images,
      shop_id: input.shopId || null,
      category_id: input.categoryId || null,
      location_label: input.locationLabel?.trim() || null,
      price: prix,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    /*
      Le déclencheur `freeshop_limite_mensuelle` lève ce nom-là. Sans cette
      traduction, l'auteur lirait « new row violates check constraint », qui
      ne lui dit ni ce qu'il a atteint, ni quand il pourra republier.
    */
    if (insertError.message.includes("FREESHOP_LIMITE_MOIS")) {
      return fail(
        `Vous avez atteint votre limite de ${FREESHOP_PAR_MOIS} publications Free Shop pour ce mois. Vous pourrez publier à nouveau le mois prochain.`,
      );
    }
    if (insertError.message.includes("deals_quatre_photos")) {
      return fail(`Quatre photos au maximum par publication.`);
    }
    return fail(readableError(insertError));
  }

  revalidatePath("/free-shop");
  return ok({ id: data.id });
}

/**
 * Le quota du mois, tel que l'écran doit l'annoncer.
 *
 * Lu par la même fonction que celle qui décide — `freeshop_quota` compte
 * exactement ce que compte le déclencheur. Deux comptages séparés auraient
 * fini par diverger, et l'écran aurait annoncé « 2/3 » devant un refus.
 */
export async function freeShopQuota(): Promise<{ utilisees: number; plafond: number }> {
  const { supabase, profile } = await requireProfile();
  if (!profile) return { utilisees: 0, plafond: FREESHOP_PAR_MOIS };

  const { data } = await supabase.rpc("freeshop_quota");
  const ligne = Array.isArray(data) ? data[0] : null;

  return {
    utilisees: ligne?.utilisees ?? 0,
    plafond: ligne?.plafond ?? FREESHOP_PAR_MOIS,
  };
}

/**
 * La décision de l'administration sur une publication.
 *
 * Passe par la fonction de base plutôt que par un `update` : elle seule
 * pose la date, l'auteur de la décision et le motif d'un seul geste, et
 * elle refuse un refus sans motif — le membre doit lire pourquoi.
 */
export async function modererPublication(
  dealId: string,
  decision: "approved" | "rejected",
  motif?: string,
) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase.rpc("freeshop_moderer", {
    p_deal: dealId,
    p_decision: decision,
    p_motif: motif?.trim() || null,
  });

  if (e) {
    if (e.message.includes("FREESHOP_MOTIF")) return fail("Indiquez le motif du refus");
    return fail(readableError(e));
  }

  revalidatePath("/admin/free-shop");
  revalidatePath("/free-shop");
  revalidatePath("/accueil");
  return done();
}

/**
 * Vote « Ça marche » / négatif.
 * Le trigger `sync_deal_votes` recompte, décerne le badge « Vérifié » à la
 * troisième confirmation et crédite 20 points à l'auteur — rien de tout cela
 * ne se décide ici.
 */
export async function voteDeal(dealId: string, value: 1 | -1, current: number | null) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (current === value) {
    // Deuxième appui sur le même bouton : on retire le vote.
    const { error: e } = await supabase
      .from("deal_votes")
      .delete()
      .match({ deal_id: dealId, user_id: profile.id });
    if (e) return fail(readableError(e));
  } else {
    const { error: e } = await supabase
      .from("deal_votes")
      .upsert({ deal_id: dealId, user_id: profile.id, value }, { onConflict: "deal_id,user_id" });

    if (e) {
      // La policy interdit de voter pour son propre bon plan.
      if (e.code === "42501") return fail("Vous ne pouvez pas confirmer votre propre bon plan");
      return fail(readableError(e));
    }
  }

  revalidatePath("/free-shop");
  return done();
}

export async function commentDeal(dealId: string, body: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const text = body.trim();
  if (!text) return fail("Commentaire vide");

  const { error: e } = await supabase
    .from("deal_comments")
    .insert({ deal_id: dealId, user_id: profile.id, body: text });

  if (e) return fail(readableError(e));

  revalidatePath(`/free-shop/${dealId}`);
  return done();
}

export async function reportDeal(dealId: string, reason?: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase.from("reports").insert({
    reporter_id: profile.id,
    target_type: "deal",
    target_id: dealId,
    reason: reason?.trim() || null,
  });

  // 23505 : déjà signalé par cette personne — l'intention est satisfaite.
  if (e && e.code !== "23505") return fail(readableError(e));
  return done();
}

export async function deleteDeal(dealId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase.from("deals").delete().eq("id", dealId);
  if (e) return fail(readableError(e));

  revalidatePath("/free-shop");
  return done();
}

/* ─── Modération ───────────────────────────────────────────────────────── */

export async function moderateDeal(dealId: string, decision: "remove" | "keep") {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (decision === "remove") {
    const { error: e } = await supabase.from("deals").update({ status: "removed" }).eq("id", dealId);
    if (e) return fail(readableError(e));
  }

  const { error: e } = await supabase
    .from("reports")
    .update({
      status: decision === "remove" ? "resolved" : "dismissed",
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
    })
    .match({ target_type: "deal", target_id: dealId, status: "open" });

  if (e) return fail(readableError(e));

  revalidatePath("/admin");
  revalidatePath("/free-shop");
  return done();
}
