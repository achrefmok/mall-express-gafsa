"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { done, fail, ok, readableError, requireAdmin } from "./_helpers";
import type { UserRole } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/server";
import { signaler } from "@/lib/signal";
import { ressembleAUneAdresseEmail } from "@/lib/format";

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

/**
 * Corrige la fiche d'une boutique depuis l'administration.
 *
 * Pour une faute de frappe, une adresse à jour ou une catégorie mal choisie
 * à l'inscription — sans repasser par le compte du commerçant, qui n'a pas
 * toujours la main (boutique créée par code d'activation, compte perdu…).
 */
export async function updateShopAdmin(
  shopId: string,
  input: {
    name: string;
    nameAr?: string;
    categoryId?: string | null;
    address?: string;
    phone?: string;
    whatsapp?: string;
    instagram?: string;
    facebookUrl?: string;
    mallLevel?: number | null;
    mallUnit?: string;
  },
) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const name = input.name.trim();
  if (name.length < 2) return fail("Le nom de la boutique est obligatoire");
  if (ressembleAUneAdresseEmail(name)) {
    return fail("Le nom de la boutique ne doit pas être une adresse e-mail");
  }

  const { error: e } = await supabase
    .from("shops")
    .update({
      name,
      name_ar: input.nameAr?.trim() || null,
      category_id: input.categoryId || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      instagram: input.instagram?.trim() || null,
      facebook_url: input.facebookUrl?.trim() || null,
      mall_level: input.mallLevel ?? null,
      mall_unit: input.mallUnit?.trim() || null,
    })
    .eq("id", shopId);

  if (e) return fail(readableError(e));

  const { data: boutique } = await supabase.from("shops").select("slug").eq("id", shopId).maybeSingle();

  revalidatePath(`/admin/boutiques/${shopId}`);
  revalidatePath("/admin/boutiques");
  revalidatePath("/marketplace");
  if (boutique?.slug) revalidatePath(`/boutique/${boutique.slug}`);
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

  const { data: avant } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  // La règle « il reste toujours un administrateur » est appliquée en SQL :
  // elle doit tenir même si deux consoles retirent un rôle en même temps.
  const { error: e } = await supabase.rpc("set_member_role", {
    target: userId,
    new_role: role,
  });

  if (e) return fail(readableError(e));

  // Journal pour /admin/securite — voir `role_changes`. Best-effort : un échec
  // ici ne doit jamais faire paraître le changement de rôle lui-même en échec.
  // Table absente des types générés tant que la migration n'est pas collée
  // (même raison que `product_packs` dans `vendor.ts`) : client non typé.
  if (avant && avant.role !== role) {
    const client = supabase as unknown as SupabaseClient;
    const { error: logError } = await client.from("role_changes").insert({
      target_id: userId,
      previous_role: avant.role,
      new_role: role,
      changed_by: profile.id,
    });
    if (logError && !["42P01", "PGRST205"].includes(logError.code)) {
      signaler(logError, { ou: "journal des changements de rôle", quoi: { userId } });
    }
  }

  revalidatePath("/admin/membres");
  revalidatePath("/admin");
  revalidatePath("/admin/securite");
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

/**
 * Le lien d'une affiche : http(s) seulement.
 *
 * Il entre dans un `<a>` : `javascript:` et `data:` n'y ont rien à faire.
 */
function lienAffiche(brut?: string): { ok: true; lien: string | null } | { ok: false; error: string } {
  if (!brut?.trim()) return { ok: true, lien: null };
  try {
    const parsed = new URL(brut.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Le lien doit commencer par https://" };
    }
    return { ok: true, lien: parsed.toString() };
  } catch {
    return { ok: false, error: "Lien invalide" };
  }
}

export async function createSponsoredSlot(input: {
  advertiser: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  linkUrl?: string;
  shopId?: string;
  startsAt?: string;
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

  const debut = input.startsAt ? new Date(input.startsAt) : null;
  if (debut && (Number.isNaN(debut.getTime()) || debut.getTime() >= ends.getTime())) {
    return fail("La date de début doit précéder la date de fin");
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
    starts_at: debut?.toISOString(),
    ends_at: ends.toISOString(),
  });

  if (e) return fail(readableError(e));

  revalidatePath("/admin/sponsors");
  revalidatePath("/accueil");
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
  revalidatePath("/admin/sponsors");
  revalidatePath("/accueil");
  revalidatePath("/");
  return done();
}

/**
 * Corriger une affiche, plutôt qu'en créer une seconde.
 *
 * L'écran ne savait que créer et couper la diffusion : une faute de frappe, une
 * image à remplacer ou une date à prolonger obligeaient à recommencer, et
 * l'ancienne affiche restait dans la liste. On met à jour la ligne existante —
 * même identifiant, aucun doublon.
 */
export async function updateSponsoredSlot(
  slotId: string,
  input: {
    advertiser?: string;
    title: string;
    subtitle?: string;
    imageUrl?: string | null;
    linkUrl?: string;
    shopId?: string;
    startsAt?: string;
    endsAt: string;
    position?: number;
  },
) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (!input.title.trim()) return fail("Le titre est obligatoire");

  const ends = new Date(input.endsAt);
  if (Number.isNaN(ends.getTime())) return fail("Date de fin invalide");

  const debut = input.startsAt ? new Date(input.startsAt) : null;
  if (debut && (Number.isNaN(debut.getTime()) || debut.getTime() >= ends.getTime())) {
    return fail("La date de début doit précéder la date de fin");
  }

  const lien = lienAffiche(input.linkUrl);
  if (!lien.ok) return fail(lien.error);

  const { error: e } = await supabase
    .from("sponsored_slots")
    .update({
      ...(input.advertiser?.trim() ? { advertiser: input.advertiser.trim() } : {}),
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      image_url: input.imageUrl ?? null,
      link_url: lien.lien,
      shop_id: input.shopId || null,
      position: input.position ?? 0,
      ...(debut ? { starts_at: debut.toISOString() } : {}),
      ends_at: ends.toISOString(),
    })
    .eq("id", slotId);

  if (e) return fail(readableError(e));

  revalidatePath("/admin/sponsors");
  revalidatePath("/accueil");
  revalidatePath("/");
  return done();
}

/**
 * Chercher un membre par son nom ou son numéro.
 *
 * Les écrans d'administration interrogeaient `profiles` directement depuis le
 * navigateur, donc avec le rôle `authenticated`. Depuis l'audit du 26 août 2026,
 * ce rôle n'a plus accès à la colonne `phone` — elle était moissonnable par
 * n'importe qui avec la clé publique. La recherche remonte donc côté serveur,
 * où `requireAdmin` vérifie qui appelle avant que la clé de service ne franchisse
 * la restriction.
 *
 * C'est de toute façon la bonne place pour une recherche sur les membres : le
 * navigateur n'avait aucune raison de pouvoir balayer la table entière.
 */
export async function chercherMembres(terme: string) {
  const { profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const q = terme.trim();
  // Deux caractères : en dessous, la recherche ramène la moitié de la ville.
  if (q.length < 2) return ok([] as Membre[]);

  /*
    Les caractères de motif sont neutralisés.

    `%` et `_` ont un sens dans un `ilike`, et `,` sépare les conditions d'un
    `or` PostgREST : un terme mal filtré permettrait d'élargir la requête
    au-delà de ce que l'écran propose.
  */
  const propre = q.replace(/[%_,()]/g, " ").trim();
  if (propre.length < 2) return ok([] as Membre[]);

  const admin = createAdminClient();
  const { data, error: lectureError } = await admin
    .from("profiles")
    .select("id, first_name, last_name, phone")
    .or(`first_name.ilike.%${propre}%,last_name.ilike.%${propre}%,phone.ilike.%${propre}%`)
    .limit(8);

  if (lectureError) return fail(readableError(lectureError));
  return ok((data ?? []) as Membre[]);
}

export interface Membre {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

/* ─── Pharmacies de garde ─────────────────────────────────────────────── */

/**
 * Ajoute ou corrige une pharmacie de garde pour une date donnée.
 *
 * Depuis que la rotation automatique a été retirée, c'est l'administration qui
 * fixe la liste des gardes de chaque jour — nom, adresse, téléphone, et la
 * position qui la place sur la carte de l'écran Services.
 */
export async function savePharmacyDuty(input: {
  id?: string;
  onDate: string;
  name: string;
  address?: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.onDate)) return fail("Date invalide");
  if (!input.name.trim()) return fail("Le nom de la pharmacie est obligatoire");

  const payload = {
    on_date: input.onDate,
    name: input.name.trim(),
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };

  const query = input.id
    ? supabase.from("pharmacies_on_duty").update(payload).eq("id", input.id)
    : supabase.from("pharmacies_on_duty").insert(payload);

  const { error: e } = await query;
  if (e) return fail(readableError(e));

  revalidatePath("/services");
  revalidatePath("/admin/pharmacies");
  return done();
}

export async function removePharmacyDuty(id: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase.from("pharmacies_on_duty").delete().eq("id", id);
  if (e) return fail(readableError(e));

  revalidatePath("/services");
  revalidatePath("/admin/pharmacies");
  return done();
}

/** Définir le logo de l'application depuis l'administration. */
export async function setAppLogo(logoUrl: string | null) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("app_brand")
    .update({ app_logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (e) return fail(readableError(e));

  revalidatePath("/");
  revalidatePath("/accueil");
  /*
    Le logo est gardé une minute par `lireMarque` : icône installée, favicon,
    images de partage. Sans cette ligne, le nouveau logo n'apparaîtrait
    qu'à l'expiration du cache — une minute pendant laquelle l'administrateur
    croirait que son changement n'a pas été pris.
  */
  revalidateTag("brand");
  return done();
}

/**
 * Ouvre ou referme l'accès public — un seul interrupteur, lu par
 * l'intergiciel à chaque requête (voir `src/lib/supabase/middleware.ts`).
 *
 * Aucun cache à purger : contrairement au logo, cette valeur n'est jamais
 * mise en mémoire — la fermeture doit être instantanée, y compris pour un
 * visiteur déjà en train de naviguer.
 */
export async function definirAccesPublic(ouvert: boolean) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("app_access")
    .update({ public_access: ouvert, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (e) return fail(readableError(e));

  revalidatePath("/", "layout");
  return done();
}

/**
 * Faire — ou défaire — un partenaire.
 *
 * Le drapeau vaut une place sur l'accueil : il n'appartient donc pas au
 * commerçant, et un déclencheur de base (`guard_shop_partenaire`) le lui
 * refuse même s'il écrit directement. Cette action est le seul chemin.
 *
 * Le rang ordonne les partenaires entre eux ; laissé vide, c'est le plus
 * récemment approuvé qui passe devant.
 */
export async function definirPartenaire(input: {
  shopId: string;
  isPartner: boolean;
  rank?: number | null;
  tagline?: string | null;
  taglineAr?: string | null;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("shops")
    .update({
      is_partner: input.isPartner,
      partner_rank: input.rank ?? null,
      partner_tagline: input.tagline?.trim() || null,
      partner_tagline_ar: input.taglineAr?.trim() || null,
    })
    .eq("id", input.shopId);

  if (e) return fail(readableError(e));

  revalidatePath("/admin/partenaires");
  revalidatePath("/accueil");
  revalidatePath("/");
  return done();
}
