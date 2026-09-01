"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile, requireShopOwner } from "./_helpers";
import type { Database, OrderStatus } from "@/types/database";

/* ─── Catalogue ────────────────────────────────────────────────────────── */

export async function upsertProduct(input: {
  id?: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  lowStockThreshold?: number;
  categoryId?: string | null;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  isOnline?: boolean;
  isDraft?: boolean;
  mallPickupAvailable?: boolean;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const name = input.name.trim();
  if (!name) return fail("Le nom du produit est obligatoire");
  if (!Number.isFinite(input.price) || input.price < 0) return fail("Prix invalide");
  if (!Number.isInteger(input.stock) || input.stock < 0) return fail("Stock invalide");

  if (input.compareAtPrice != null && input.compareAtPrice < input.price) {
    return fail("Le prix barré doit être supérieur au prix de vente");
  }

  // Une boutique non approuvée peut préparer jusqu'à 5 produits.
  if (!input.id && shop.status !== "approved") {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id);

    if ((count ?? 0) >= 5) {
      return fail("Limite de 5 produits avant l'approbation de votre boutique");
    }
  }

  const payload = {
    shop_id: shop.id,
    name,
    name_ar: input.nameAr?.trim() || null,
    description: input.description?.trim() || null,
    description_ar: input.descriptionAr?.trim() || null,
    price: input.price,
    compare_at_price: input.compareAtPrice ?? null,
    stock: input.stock,
    low_stock_threshold: input.lowStockThreshold ?? 3,
    category_id: input.categoryId || null,
    images: input.images ?? [],
    colors: input.colors ?? [],
    sizes: input.sizes ?? [],
    is_online: input.isOnline ?? true,
    is_draft: input.isDraft ?? false,
    mall_pickup_available: input.mallPickupAvailable ?? true,
  };

  const query = input.id
    ? supabase.from("products").update(payload).eq("id", input.id).eq("shop_id", shop.id)
    : supabase.from("products").insert(payload);

  const { data, error: writeError } = await query.select("id").single();
  if (writeError) return fail(readableError(writeError));

  revalidatePath("/vendeur/produits");
  revalidatePath("/marketplace");
  return ok({ id: data.id });
}

export async function setProductOnline(productId: string, online: boolean) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: e } = await supabase
    .from("products")
    .update({ is_online: online })
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/produits");
  return done();
}

/** Réapprovisionnement rapide : « − 10 + » de l'écran 9. */
export async function adjustStock(productId: string, delta: number) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!product) return fail("Produit introuvable");

  const next = Math.max(0, product.stock + delta);

  const { error: e } = await supabase
    .from("products")
    .update({ stock: next })
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/produits");
  return ok({ stock: next });
}

export async function deleteProduct(productId: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { error: e } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/produits");
  return done();
}

/* ─── Commandes ────────────────────────────────────────────────────────── */

export async function advanceOrder(orderId: string, status: OrderStatus) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { data: order, error: e } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .select("user_id, order_number")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/commandes");
  revalidatePath("/commandes");
  return ok(order);
}

/* ─── Création de la boutique ──────────────────────────────────────────── */

/**
 * Crée la boutique d'un vendeur qui n'en a pas encore.
 *
 * Le cas se produit à deux occasions : une inscription vendeur sans nom de
 * boutique — `handle_new_user` ne crée alors rien — et un client promu
 * vendeur depuis /admin/membres. Sans cet écran, ces comptes tournent en rond
 * dans l'espace vendeur.
 */
export async function createMyShop(input: {
  name: string;
  categoryId?: string | null;
  address?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  facebookUrl?: string;
  description?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (profile.role !== "vendor" && profile.role !== "admin") {
    return fail("Réservé aux comptes vendeur");
  }

  const name = input.name.trim();
  if (name.length < 2) return fail("Le nom de la boutique est obligatoire");

  const { data: existing } = await supabase
    .from("shops")
    .select("slug")
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (existing) return ok({ slug: existing.slug });

  // Même construction de slug que le trigger handle_new_user : on translitère,
  // puis on suffixe tant que le slug est pris.
  const { data: base } = await supabase.rpc("slugify", { input: name });
  let slug = base || "boutique";

  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const { data: taken } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!taken) break;
    slug = `${base || "boutique"}-${suffix}`;
  }

  // `status` n'est pas transmis : la valeur par défaut est `pending`, et le
  // trigger guard_shop_privileges refuserait toute autre valeur.
  const { data, error: e } = await supabase
    .from("shops")
    .insert({
      owner_id: profile.id,
      slug,
      name,
      category_id: input.categoryId || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      instagram: input.instagram?.trim() || null,
      facebook_url: input.facebookUrl?.trim() || null,
      description: input.description?.trim() || null,
      logo_url: input.logoUrl || null,
      cover_url: input.coverUrl || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .select("slug")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur", "layout");
  return ok({ slug: data.slug });
}

/* ─── Réglages boutique (écran 10) ─────────────────────────────────────── */

export async function updateShopSettings(input: {
  name?: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  phone?: string;
  mallLevel?: number | null;
  mallUnit?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deliversInGafsa?: boolean;
  pickupInStore?: boolean;
  isOpenNow?: boolean;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  if (input.name !== undefined && !input.name.trim()) {
    return fail("Le nom de la boutique est obligatoire");
  }

  // `status`, `is_featured` et les compteurs sont neutralisés par le trigger
  // guard_shop_privileges : inutile de les filtrer ici, mais on ne les
  // transmet pas non plus.
  const patch: Database["public"]["Tables"]["shops"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.nameAr !== undefined) patch.name_ar = input.nameAr.trim() || null;
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.descriptionAr !== undefined) patch.description_ar = input.descriptionAr.trim() || null;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl;
  if (input.bannerUrl !== undefined) patch.banner_url = input.bannerUrl;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.mallLevel !== undefined) patch.mall_level = input.mallLevel;
  if (input.mallUnit !== undefined) patch.mall_unit = input.mallUnit?.trim() || null;
  if (input.address !== undefined) patch.address = input.address?.trim() || null;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.deliversInGafsa !== undefined) patch.delivers_in_gafsa = input.deliversInGafsa;
  if (input.pickupInStore !== undefined) patch.pickup_in_store = input.pickupInStore;
  if (input.isOpenNow !== undefined) patch.is_open_now = input.isOpenNow;

  if (Object.keys(patch).length === 0) return done();

  const { error: e } = await supabase.from("shops").update(patch).eq("id", shop.id);
  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/reglages");
  revalidatePath(`/boutique/${shop.slug}`);
  return done();
}

export async function updateShopHours(
  hours: Array<{ weekday: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }>,
) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  for (const day of hours) {
    if (!day.isClosed && (!day.opensAt || !day.closesAt)) {
      return fail("Renseignez les deux horaires ou marquez le jour comme fermé");
    }
    if (!day.isClosed && day.opensAt! >= day.closesAt!) {
      return fail("L'heure de fermeture doit suivre l'heure d'ouverture");
    }
  }

  const { error: e } = await supabase.from("shop_hours").upsert(
    hours.map((day) => ({
      shop_id: shop.id,
      weekday: day.weekday,
      opens_at: day.isClosed ? null : day.opensAt,
      closes_at: day.isClosed ? null : day.closesAt,
      is_closed: day.isClosed,
    })),
    { onConflict: "shop_id,weekday" },
  );

  if (e) return fail(readableError(e));

  revalidatePath("/vendeur/reglages");
  return done();
}

export async function updateShopCategories(categoryIds: string[]) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  await supabase.from("shop_categories").delete().eq("shop_id", shop.id);

  if (categoryIds.length > 0) {
    const { error: e } = await supabase
      .from("shop_categories")
      .insert(categoryIds.map((category_id) => ({ shop_id: shop.id, category_id })));
    if (e) return fail(readableError(e));
  }

  revalidatePath("/vendeur/reglages");
  return done();
}

export async function upsertPromotion(input: {
  id?: string;
  title: string;
  titleAr?: string;
  percentOff: number;
  endsAt: string;
  isActive?: boolean;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  if (input.percentOff < 1 || input.percentOff > 90) {
    return fail("La remise doit être comprise entre 1 % et 90 %");
  }

  const payload = {
    shop_id: shop.id,
    title: input.title.trim(),
    title_ar: input.titleAr?.trim() || null,
    percent_off: input.percentOff,
    ends_at: new Date(input.endsAt).toISOString(),
    is_active: input.isActive ?? true,
  };

  const query = input.id
    ? supabase.from("promotions").update(payload).eq("id", input.id).eq("shop_id", shop.id)
    : supabase.from("promotions").insert(payload);

  const { error: e } = await query;
  if (e) return fail(readableError(e));

  revalidatePath("/vendeur");
  revalidatePath(`/boutique/${shop.slug}`);
  return done();
}
