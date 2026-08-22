"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireAdmin } from "./_helpers";
import type { UserRole } from "@/types/database";

/* ─── Validation des boutiques (écran 14) ──────────────────────────────── */

export async function approveShop(shopId: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: rpcError } = await supabase.rpc("approve_shop", { target_shop: shopId });
  if (rpcError) return fail(readableError(rpcError));

  revalidatePath("/admin");
  revalidatePath("/marketplace");
  return done();
}

export async function rejectShop(shopId: string, reason: string, missingDocument?: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (!reason.trim() && !missingDocument?.trim()) {
    return fail("Indiquez un motif ou le document manquant");
  }

  const { error: rpcError } = await supabase.rpc("reject_shop", {
    target_shop: shopId,
    reason: reason.trim(),
    missing_doc: missingDocument?.trim() || null,
  });

  if (rpcError) return fail(readableError(rpcError));

  revalidatePath("/admin");
  return done();
}

export async function setShopFeatured(shopId: string, featured: boolean) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("shops")
    .update({ is_featured: featured })
    .eq("id", shopId);

  if (e) return fail(readableError(e));

  revalidatePath("/admin");
  revalidatePath("/");
  return done();
}

export async function setUserBanned(userId: string, banned: boolean) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  // Un administrateur ne se bannit pas lui-même : cela verrouillerait la
  // console pour tout le monde s'il est seul.
  if (userId === profile.id) return fail("Vous ne pouvez pas suspendre votre propre compte");

  const { error: e } = await supabase
    .from("profiles")
    .update({ is_banned: banned })
    .eq("id", userId);

  if (e) return fail(readableError(e));

  revalidatePath("/admin/membres");
  return done();
}

/* ─── Équipe d'administration ──────────────────────────────────────────── */

/**
 * Nomme un administrateur à partir de son adresse.
 *
 * Le compte doit déjà exister : on ne crée pas d'utilisateur ici, faute de
 * pouvoir lui transmettre un mot de passe autrement qu'en clair. La personne
 * s'inscrit normalement, puis on la promeut.
 */
export async function grantAdminByEmail(email: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return fail("Adresse e-mail invalide");

  const { data, error: e } = await supabase.rpc("grant_admin_by_email", {
    target_email: address,
  });

  if (e) return fail(readableError(e));

  revalidatePath("/admin/membres");
  return ok({ id: data as string });
}

export async function setMemberRole(userId: string, role: UserRole) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  // La règle « il reste toujours un administrateur » est appliquée en SQL :
  // elle doit tenir même si deux consoles retirent un rôle en même temps.
  const { error: e } = await supabase.rpc("set_member_role", {
    target: userId,
    new_role: role,
  });

  if (e) return fail(readableError(e));

  revalidatePath("/admin/membres");
  revalidatePath("/admin");
  return done();
}

/* ─── Alertes ville ────────────────────────────────────────────────────── */

export async function publishCityAlert(input: {
  title: string;
  titleAr?: string;
  body?: string;
  severity: "info" | "warning" | "critical";
  days: number;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (!input.title.trim()) return fail("Le titre est obligatoire");

  const { error: e } = await supabase.from("city_alerts").insert({
    title: input.title.trim(),
    title_ar: input.titleAr?.trim() || null,
    body: input.body?.trim() || null,
    severity: input.severity,
    ends_at: new Date(Date.now() + Math.max(1, input.days) * 86_400_000).toISOString(),
    created_by: profile.id,
  });

  if (e) return fail(readableError(e));

  revalidatePath("/services");
  revalidatePath("/admin");
  return done();
}

export async function deactivateCityAlert(alertId: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("city_alerts")
    .update({ is_active: false })
    .eq("id", alertId);

  if (e) return fail(readableError(e));

  revalidatePath("/services");
  revalidatePath("/admin");
  return done();
}

/* ─── Catégories ───────────────────────────────────────────────────────── */

export async function upsertCategory(input: {
  id?: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  hue: number;
  monogram: string;
  sortOrder?: number;
  isActive?: boolean;
  /** Photo carrée de la catégorie. `null` retire celle en place. */
  imageUrl?: string | null;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (input.hue < 0 || input.hue > 360) return fail("La teinte doit être comprise entre 0 et 360");
  if (input.monogram.length < 1 || input.monogram.length > 2) {
    return fail("Le monogramme fait une ou deux lettres");
  }

  const payload = {
    slug: input.slug.trim().toLowerCase(),
    name_fr: input.nameFr.trim(),
    name_ar: input.nameAr.trim(),
    hue: input.hue,
    monogram: input.monogram.toUpperCase(),
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
    /*
      `undefined` laisse la photo en place, `null` l'efface.

      Sans cette distinction, enregistrer un simple changement de teinte
      effacerait l'image de la catégorie : le formulaire de création ne la
      transporte pas, et un `?? null` l'aurait donc écrasée à chaque fois.
    */
    ...(input.imageUrl !== undefined && { image_url: input.imageUrl }),
  };

  const query = input.id
    ? supabase.from("categories").update(payload).eq("id", input.id)
    : supabase.from("categories").insert(payload);

  const { error: e } = await query;
  if (e) return fail(readableError(e));

  revalidatePath("/admin");
  revalidatePath("/marketplace");
  return done();
}

/* ─── Régie ────────────────────────────────────────────────────────────── */

export async function createSponsoredSlot(input: {
  advertiser: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  linkUrl?: string;
  shopId?: string;
  endsAt: string;
  position?: number;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (!input.advertiser.trim()) return fail("Le nom de l'annonceur est obligatoire");
  if (!input.title.trim()) return fail("Le titre est obligatoire");

  const ends = new Date(input.endsAt);
  if (Number.isNaN(ends.getTime()) || ends.getTime() <= Date.now()) {
    return fail("La date de fin doit être dans le futur");
  }

  // Un lien externe entre dans un <a> : on n'accepte que http(s), pour
  // écarter javascript: et data:.
  let link: string | null = null;
  if (input.linkUrl?.trim()) {
    try {
      const parsed = new URL(input.linkUrl.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return fail("Le lien doit commencer par https://");
      }
      link = parsed.toString();
    } catch {
      return fail("Lien invalide");
    }
  }

  const { error: e } = await supabase.from("sponsored_slots").insert({
    advertiser: input.advertiser.trim(),
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    image_url: input.imageUrl ?? null,
    link_url: link,
    shop_id: input.shopId || null,
    position: input.position ?? 0,
    ends_at: ends.toISOString(),
  });

  if (e) return fail(readableError(e));

  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return done();
}

export async function toggleSponsoredSlot(slotId: string, active: boolean) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("sponsored_slots")
    .update({ is_active: active })
    .eq("id", slotId);

  if (e) return fail(readableError(e));

  revalidatePath("/admin");
  revalidatePath("/");
  return done();
}
