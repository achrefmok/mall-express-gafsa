"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile } from "./_helpers";
import type { DeliveryMethod, PaymentMethod } from "@/types/database";

export async function addToCart(input: {
  productId: string;
  quantity?: number;
  color?: string | null;
  size?: string | null;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const quantity = Math.min(99, Math.max(1, input.quantity ?? 1));

  // Vérifier la disponibilité avant d'ajouter : mieux vaut refuser ici que
  // laisser l'utilisateur découvrir la rupture au moment de payer.
  const { data: product } = await supabase
    .from("products")
    .select("id, stock, is_online, is_draft")
    .eq("id", input.productId)
    .single();

  if (!product || !product.is_online || product.is_draft) return fail("Produit indisponible");
  if (product.stock < quantity) return fail("Stock insuffisant");

  const color = input.color?.trim() || null;
  const size = input.size?.trim() || null;

  // `is` pour NULL, `eq` pour une valeur : en SQL `color = NULL` n'est jamais
  // vrai, il faut `color IS NULL` pour retrouver la ligne sans variante.
  let lookup = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", profile.id)
    .eq("product_id", input.productId);

  lookup = color === null ? lookup.is("color", null) : lookup.eq("color", color);
  lookup = size === null ? lookup.is("size", null) : lookup.eq("size", size);

  const { data: existing } = await lookup.maybeSingle();

  if (existing) {
    const next = Math.min(99, existing.quantity + quantity);
    if (next > product.stock) return fail("Stock insuffisant");

    const { error: e } = await supabase
      .from("cart_items")
      .update({ quantity: next })
      .eq("id", existing.id);
    if (e) return fail(readableError(e));
  } else {
    const { error: e } = await supabase.from("cart_items").insert({
      user_id: profile.id,
      product_id: input.productId,
      quantity,
      color,
      size,
    });
    if (e) return fail(readableError(e));
  }

  revalidatePath("/panier");
  return done();
}

export async function setCartQuantity(itemId: string, quantity: number) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (quantity <= 0) return removeFromCart(itemId);

  const { error: e } = await supabase
    .from("cart_items")
    .update({ quantity: Math.min(99, quantity) })
    .eq("id", itemId)
    .eq("user_id", profile.id);

  if (e) return fail(readableError(e));

  revalidatePath("/panier");
  return done();
}

export async function removeFromCart(itemId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", profile.id);

  if (e) return fail(readableError(e));

  revalidatePath("/panier");
  return done();
}

export async function toggleFavorite(productId: string, isFavorite: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (isFavorite) {
    const { error: e } = await supabase
      .from("favorites")
      .delete()
      .match({ user_id: profile.id, product_id: productId });
    if (e) return fail(readableError(e));
  } else {
    const { error: e } = await supabase
      .from("favorites")
      .insert({ user_id: profile.id, product_id: productId });
    if (e && e.code !== "23505") return fail(readableError(e));
  }

  revalidatePath(`/produit/${productId}`);
  return done();
}

export async function toggleFollowShop(shopId: string, isFollowing: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (isFollowing) {
    const { error: e } = await supabase
      .from("shop_follows")
      .delete()
      .match({ user_id: profile.id, shop_id: shopId });
    if (e) return fail(readableError(e));
  } else {
    const { error: e } = await supabase
      .from("shop_follows")
      .insert({ user_id: profile.id, shop_id: shopId });
    if (e && e.code !== "23505") return fail(readableError(e));
  }

  return done();
}

/**
 * Passe la commande d'une boutique. Le total, la remise live et le décrément
 * de stock sont calculés par la fonction SQL `place_order` : le client ne
 * transmet que ce qu'il veut acheter, jamais un prix.
 */
export async function placeOrder(input: {
  shopId: string;
  items: Array<{ product_id: string; quantity: number; color?: string | null; size?: string | null }>;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  contactPhone: string;
  deliveryAddress?: string;
  note?: string;
  liveId?: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (input.items.length === 0) return fail("Panier vide");

  const phone = input.contactPhone.trim();
  if (!phone) return fail("Un numéro de téléphone est nécessaire");

  if (input.deliveryMethod === "delivery" && !input.deliveryAddress?.trim()) {
    return fail("Une adresse de livraison est nécessaire");
  }

  const { data, error: rpcError } = await supabase.rpc("place_order", {
    p_shop_id: input.shopId,
    p_items: input.items,
    p_payment_method: input.paymentMethod,
    p_delivery_method: input.deliveryMethod,
    p_contact_phone: phone,
    p_delivery_address: input.deliveryAddress?.trim() ?? null,
    p_note: input.note?.trim() ?? null,
    p_live_id: input.liveId ?? null,
  });

  if (rpcError) return fail(readableError(rpcError));

  revalidatePath("/panier");
  revalidatePath("/commandes");
  return ok(data);
}
