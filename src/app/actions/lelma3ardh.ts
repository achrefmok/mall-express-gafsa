"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireExhibitor, requireProfile } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { signaler } from "@/lib/signal";

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

/** Un mot de passe qu'on ne demande à personne de retenir : il est affiché une fois, puis copié. */
function genererMotDePasse(): string {
  return `${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}A9!`;
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

/**
 * Prénom, nom, un bouton — le compte suit tout seul.
 *
 * Trois écritures, dans un ordre qui compte : le compte d'authentification
 * d'abord (le stand a besoin de son identifiant), puis le rôle — jamais
 * accordé par le déclencheur `handle_new_user`, qui n'accepte que « client »
 * ou « vendor » depuis les métadonnées d'un client —, puis le stand
 * lui-même, déjà rattaché à ce compte et déjà approuvé : c'est
 * l'administration qui vient de le créer, il n'y a personne d'autre à qui
 * demander une validation.
 *
 * Un échec en cours de route retire ce qui a déjà été posé plutôt que de
 * laisser un compte sans stand ou un rôle sans compte.
 */
export async function creerExposantAvecCompte(input: { expoId: string; prenom: string; nom: string }) {
  const { profile, error } = await exigerDahmani();
  if (!profile) return fail(error);

  const prenom = input.prenom.trim();
  const nom = input.nom.trim();
  if (!prenom || !nom) return fail("Prénom et nom requis");

  const admin = createAdminClient();

  const identifiant = `${slugifier(prenom)}-${slugifier(nom)}-${Date.now().toString(36)}`;
  const email = `${identifiant}@exposant.lelma3ardh.gafsa.tn`;
  const password = genererMotDePasse();

  const { data: cree, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: prenom, last_name: nom, role: "client" },
  });

  if (authError || !cree.user) {
    signaler(authError, { ou: "création d'un compte exposant", quoi: { prenom, nom } });
    return fail("Impossible de créer le compte");
  }

  const userId = cree.user.id;

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "exhibitor" })
    .eq("id", userId);

  if (roleError) {
    await admin.auth.admin.deleteUser(userId);
    signaler(roleError, { ou: "attribution du rôle exposant", quoi: { userId } });
    return fail("Impossible d'attribuer le rôle — rien n'a été créé");
  }

  const { data: stand, error: standError } = await admin
    .from("expo_exhibitors")
    .insert({
      expo_id: input.expoId,
      slug: identifiant,
      name: `${prenom} ${nom}`,
      status: "approved",
      user_id: userId,
    })
    .select("id")
    .single();

  if (standError || !stand) {
    await admin.auth.admin.deleteUser(userId);
    signaler(standError, { ou: "création du stand lié au compte exposant", quoi: { userId } });
    return fail("Impossible de créer le stand — rien n'a été créé");
  }

  revalidatePath("/lelma3ardh/gestion");
  revalidatePath("/lelma3ardh");
  return ok({ email, password, exhibitorId: stand.id as string });
}

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

/* ═══════════════════════════════════════════════════════════════════════
   Espace exposant — un titulaire de stand agissant pour son propre compte.

   `requireExhibitor()` relit la fiche du stand à chaque appel plutôt que de
   faire confiance à un identifiant reçu du client : le stand qu'un exposant
   peut toucher est celui que la base lui connaît, jamais celui qu'une
   requête prétend viser. La politique RLS `expo_products_owner_write`
   referme la même porte une seconde fois, côté base — la vérification ici
   n'est donc pas la seule barrière, mais la première, avec un message
   clair plutôt qu'un code d'erreur PostgREST.
   ═══════════════════════════════════════════════════════════════════════ */

/** Les informations que le titulaire d'un stand peut changer lui-même. */
export async function modifierMonStand(input: {
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  standNo?: string;
  phone?: string;
  whatsapp?: string;
  facebookUrl?: string;
  instagram?: string;
  address?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  images?: string[];
}) {
  const { supabase, exhibitor, error } = await requireExhibitor();
  if (!exhibitor) return fail(error);

  const { error: e } = await supabase!
    .from("expo_exhibitors")
    .update({
      name_ar: input.nameAr?.trim() || null,
      description: input.description?.trim() || null,
      description_ar: input.descriptionAr?.trim() || null,
      stand_no: input.standNo?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      facebook_url: input.facebookUrl?.trim() || null,
      instagram: input.instagram?.trim() || null,
      address: input.address?.trim() || null,
      logo_url: input.logoUrl ?? null,
      cover_url: input.coverUrl ?? null,
      images: (input.images ?? []).slice(0, 8),
    })
    // Ceinture et bretelles : même si `requireExhibitor` avait mal lu la
    // fiche, cette ligne ne peut viser que le stand qu'il vient de relire.
    .eq("id", exhibitor.id);

  if (e) return fail(readableError(e));

  revalidatePath(`/lelma3ardh/${exhibitor.slug}`);
  revalidatePath("/exposant");
  return done();
}

export async function creerProduitExposant(input: {
  name: string;
  nameAr?: string;
  description?: string;
  price?: number | null;
  compareAtPrice?: number | null;
  images?: string[];
}) {
  const { supabase, exhibitor, error } = await requireExhibitor();
  if (!exhibitor) return fail(error);

  const nom = input.name.trim();
  if (nom.length < 2) return fail("Nommez le produit");

  const prix = input.price ?? null;
  const barre = input.compareAtPrice ?? null;
  if (prix !== null && prix < 0) return fail("Prix invalide");
  if (barre !== null && prix !== null && barre <= prix) {
    return fail("Le prix barré doit être supérieur au prix de vente");
  }

  const { data, error: e } = await supabase!
    .from("expo_products")
    .insert({
      exhibitor_id: exhibitor.id,
      name: nom,
      name_ar: input.nameAr?.trim() || null,
      description: input.description?.trim() || null,
      price: prix,
      compare_at_price: barre,
      images: (input.images ?? []).slice(0, 6),
      is_available: true,
    })
    .select("id")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/exposant");
  revalidatePath(`/lelma3ardh/${exhibitor.slug}`);
  return ok({ id: data.id });
}

export async function modifierProduitExposant(input: {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  price?: number | null;
  compareAtPrice?: number | null;
  images?: string[];
  isAvailable?: boolean;
}) {
  const { supabase, exhibitor, error } = await requireExhibitor();
  if (!exhibitor) return fail(error);

  const nom = input.name.trim();
  if (nom.length < 2) return fail("Nommez le produit");

  const prix = input.price ?? null;
  const barre = input.compareAtPrice ?? null;
  if (prix !== null && prix < 0) return fail("Prix invalide");
  if (barre !== null && prix !== null && barre <= prix) {
    return fail("Le prix barré doit être supérieur au prix de vente");
  }

  // Le produit visé doit être le sien — vérifié ici, en plus de la politique
  // RLS qui referme la même porte côté base.
  const { data: existant } = await supabase!
    .from("expo_products")
    .select("exhibitor_id")
    .eq("id", input.id)
    .maybeSingle();

  if (!existant || existant.exhibitor_id !== exhibitor.id) return fail("Produit introuvable");

  const { error: e } = await supabase!
    .from("expo_products")
    .update({
      name: nom,
      name_ar: input.nameAr?.trim() || null,
      description: input.description?.trim() || null,
      price: prix,
      compare_at_price: barre,
      images: (input.images ?? []).slice(0, 6),
      is_available: input.isAvailable ?? true,
    })
    .eq("id", input.id);

  if (e) return fail(readableError(e));

  revalidatePath("/exposant");
  revalidatePath(`/lelma3ardh/${exhibitor.slug}`);
  return done();
}

export async function basculerProduitExposant(id: string, disponible: boolean) {
  const { supabase, exhibitor, error } = await requireExhibitor();
  if (!exhibitor) return fail(error);

  const { data: existant } = await supabase!
    .from("expo_products")
    .select("exhibitor_id")
    .eq("id", id)
    .maybeSingle();

  if (!existant || existant.exhibitor_id !== exhibitor.id) return fail("Produit introuvable");

  const { error: e } = await supabase!
    .from("expo_products")
    .update({ is_available: disponible })
    .eq("id", id);

  if (e) return fail(readableError(e));

  revalidatePath("/exposant");
  return done();
}

export async function supprimerProduitExposant(id: string) {
  const { supabase, exhibitor, error } = await requireExhibitor();
  if (!exhibitor) return fail(error);

  const { data: existant } = await supabase!
    .from("expo_products")
    .select("exhibitor_id")
    .eq("id", id)
    .maybeSingle();

  if (!existant || existant.exhibitor_id !== exhibitor.id) return fail("Produit introuvable");

  const { error: e } = await supabase!.from("expo_products").delete().eq("id", id);
  if (e) return fail(readableError(e));

  revalidatePath("/exposant");
  revalidatePath(`/lelma3ardh/${exhibitor.slug}`);
  return done();
}
