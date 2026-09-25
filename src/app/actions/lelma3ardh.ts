"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile } from "./_helpers";

/**
 * Société Dahmani — Lelma3ardh.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Où se joue vraiment la séparation des pouvoirs
 * ────────────────────────────────────────────────────────────────────────
 *
 * Pas ici. Les politiques de `expos`, `expo_exhibitors` et `expo_products`
 * n'ouvrent l'écriture qu'à `is_dahmani_admin()`, et aucune politique
 * ailleurs ne nomme ce rôle : il ne peut donc rien faire aux boutiques, aux
 * chauffeurs, aux membres ni aux réglages, quelle que soit la requête qu'il
 * envoie et quel que soit l'écran par lequel il passe.
 *
 * Le contrôle ci-dessous, lui, sert à écrire un message lisible plutôt qu'à
 * protéger quoi que ce soit. S'il disparaissait, la base refuserait encore.
 * C'est la seule répartition qui tienne : une règle qu'on peut oublier de
 * recopier ne doit jamais être la seule.
 */

/** Vrai pour l'administration Dahmani et pour celle de l'application. */
async function exigerDahmani() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return { supabase: null, profile: null, error };

  if (profile.role !== "dahmani_admin" && profile.role !== "admin") {
    return { supabase: null, profile: null, error: "Réservé à l'administration Lelma3ardh" };
  }

  return { supabase, profile, error: null };
}

/** Une suite d'adresse propre, à partir d'un nom. */
function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/* ─── Les éditions ────────────────────────────────────────────────────── */

export async function enregistrerExpo(input: {
  id?: string;
  name: string;
  nameAr?: string;
  description?: string;
  place?: string;
  startsOn: string;
  endsOn: string;
  isPublished?: boolean;
  coverUrl?: string | null;
}) {
  const { supabase, error } = await exigerDahmani();
  if (!supabase) return fail(error);

  const nom = input.name.trim();
  if (nom.length < 2) return fail("Nommez l'exposition");
  if (input.endsOn < input.startsOn) return fail("La fin ne peut pas précéder le début");

  const corps = {
    name: nom,
    name_ar: input.nameAr?.trim() || null,
    description: input.description?.trim() || null,
    place: input.place?.trim() || null,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    is_published: input.isPublished ?? true,
    cover_url: input.coverUrl ?? null,
  };

  const { data, error: e } = input.id
    ? await supabase.from("expos").update(corps).eq("id", input.id).select("id").single()
    : await supabase
        .from("expos")
        .insert({ ...corps, slug: `${slugifier(nom)}-${Date.now().toString(36)}` })
        .select("id")
        .single();

  if (e) return fail(readableError(e));

  revalidatePath("/lelma3ardh");
  revalidatePath("/lelma3ardh/gestion");
  // La photo de couverture alimente aussi la carte partenaire de l'accueil.
  revalidatePath("/accueil");
  revalidatePath("/partenaires");
  return ok({ id: data.id });
}

/* ─── Les exposants ───────────────────────────────────────────────────── */

export async function enregistrerExposant(input: {
  id?: string;
  expoId: string;
  name: string;
  nameAr?: string;
  description?: string;
  standNo?: string;
  phone?: string;
  whatsapp?: string;
  facebookUrl?: string;
  instagram?: string;
  address?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  images?: string[];
  status?: "pending" | "approved" | "rejected" | "suspended";
}) {
  const { supabase, error } = await exigerDahmani();
  if (!supabase) return fail(error);

  const nom = input.name.trim();
  if (nom.length < 2) return fail("Nommez l'exposant");

  const corps = {
    expo_id: input.expoId,
    name: nom,
    name_ar: input.nameAr?.trim() || null,
    description: input.description?.trim() || null,
    stand_no: input.standNo?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    facebook_url: input.facebookUrl?.trim() || null,
    instagram: input.instagram?.trim() || null,
    address: input.address?.trim() || null,
    logo_url: input.logoUrl ?? null,
    cover_url: input.coverUrl ?? null,
    // Huit photos : la contrainte de table refuse la neuvième.
    images: (input.images ?? []).slice(0, 8),
    status: input.status ?? "pending",
  };

  const { data, error: e } = input.id
    ? await supabase.from("expo_exhibitors").update(corps).eq("id", input.id).select("id").single()
    : await supabase
        .from("expo_exhibitors")
        .insert({ ...corps, slug: `${slugifier(nom)}-${Date.now().toString(36)}` })
        .select("id")
        .single();

  if (e) return fail(readableError(e));

  revalidatePath("/lelma3ardh");
  revalidatePath("/lelma3ardh/gestion");
  return ok({ id: data.id });
}

export async function supprimerExposant(id: string) {
  const { supabase, error } = await exigerDahmani();
  if (!supabase) return fail(error);

  const { error: e } = await supabase.from("expo_exhibitors").delete().eq("id", id);
  if (e) return fail(readableError(e));

  revalidatePath("/lelma3ardh");
  revalidatePath("/lelma3ardh/gestion");
  return done();
}

/* ─── Les produits d'un exposant ──────────────────────────────────────── */

export async function enregistrerProduitExpo(input: {
  id?: string;
  exhibitorId: string;
  name: string;
  nameAr?: string;
  description?: string;
  price?: number | null;
  compareAtPrice?: number | null;
  images?: string[];
  isAvailable?: boolean;
  position?: number;
}) {
  const { supabase, error } = await exigerDahmani();
  if (!supabase) return fail(error);

  const nom = input.name.trim();
  if (nom.length < 2) return fail("Nommez le produit");

  const prix = input.price ?? null;
  const barre = input.compareAtPrice ?? null;
  if (prix !== null && prix < 0) return fail("Prix invalide");
  // La base refuse aussi ce cas ; le dire ici évite un message en anglais.
  if (barre !== null && prix !== null && barre <= prix) {
    return fail("Le prix barré doit être supérieur au prix de vente");
  }

  const corps = {
    exhibitor_id: input.exhibitorId,
    name: nom,
    name_ar: input.nameAr?.trim() || null,
    description: input.description?.trim() || null,
    price: prix,
    compare_at_price: barre,
    images: (input.images ?? []).slice(0, 6),
    is_available: input.isAvailable ?? true,
    position: input.position ?? 0,
  };

  const { data, error: e } = input.id
    ? await supabase.from("expo_products").update(corps).eq("id", input.id).select("id").single()
    : await supabase.from("expo_products").insert(corps).select("id").single();

  if (e) return fail(readableError(e));

  revalidatePath("/lelma3ardh");
  revalidatePath("/lelma3ardh/gestion");
  return ok({ id: data.id });
}

export async function supprimerProduitExpo(id: string) {
  const { supabase, error } = await exigerDahmani();
  if (!supabase) return fail(error);

  const { error: e } = await supabase.from("expo_products").delete().eq("id", id);
  if (e) return fail(readableError(e));

  revalidatePath("/lelma3ardh");
  revalidatePath("/lelma3ardh/gestion");
  return done();
}
