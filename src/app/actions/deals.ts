"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireAdmin, requireProfile } from "./_helpers";

export async function createDeal(input: {
  title: string;
  body?: string;
  bodyAr?: string;
  images?: string[];
  shopId?: string;
  categoryId?: string;
  locationLabel?: string;
  expiresAt: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const title = input.title.trim();
  if (title.length < 3) return fail("Le titre doit faire au moins 3 caractères");

  const expires = new Date(input.expiresAt);
  if (Number.isNaN(expires.getTime())) return fail("Date de validité invalide");
  if (expires.getTime() <= Date.now()) return fail("La date de validité doit être dans le futur");

  const { data, error: insertError } = await supabase
    .from("deals")
    .insert({
      author_id: profile.id,
      title,
      body: input.body?.trim() || null,
      body_ar: input.bodyAr?.trim() || null,
      images: input.images ?? [],
      shop_id: input.shopId || null,
      category_id: input.categoryId || null,
      location_label: input.locationLabel?.trim() || null,
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();

  if (insertError) return fail(readableError(insertError));

  revalidatePath("/bons-plans");
  return ok({ id: data.id });
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

  revalidatePath("/bons-plans");
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

  revalidatePath(`/bons-plans/${dealId}`);
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

  revalidatePath("/bons-plans");
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
  revalidatePath("/bons-plans");
  return done();
}
