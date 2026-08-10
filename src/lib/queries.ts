import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Requêtes serveur partagées.
 *
 * `cache()` déduplique à l'échelle d'un rendu : le layout et la page peuvent
 * tous deux demander la session sans provoquer deux allers-retours.
 */

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
});

/** Compteurs des badges de la barre supérieure. */
export const getTopBarCounts = cache(async () => {
  const user = await getSessionUser();
  if (!user) return { messages: 0, notifications: 0, cart: 0 };

  const supabase = await createClient();

  const [notifications, cart, conversations] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    supabase.from("cart_items").select("quantity").eq("user_id", user.id),
    supabase.from("conversations").select("id").eq("user_id", user.id),
  ]);

  let unreadMessages = 0;
  const conversationIds = (conversations.data ?? []).map((c) => c.id);
  if (conversationIds.length > 0) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    unreadMessages = count ?? 0;
  }

  return {
    messages: unreadMessages,
    notifications: notifications.count ?? 0,
    cart: (cart.data ?? []).reduce((sum, row) => sum + row.quantity, 0),
  };
});

/**
 * Boutique du vendeur connecté, quel que soit son statut.
 *
 * `categories!shops_category_id_fkey` : deux chemins relient `shops` à
 * `categories` — la clé étrangère `category_id`, et la table de liaison
 * `shop_categories`. Sans le nom de la contrainte, PostgREST refuse de
 * choisir et renvoie 300 (PGRST201).
 */
export const getMyShop = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*, category:categories!shops_category_id_fkey(*)")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Une erreur ici renverrait `null`, que l'appelant lit comme « ce vendeur
  // n'a pas de boutique » — et le tableau de bord le redirige vers l'accueil.
  // Un écran d'erreur vaut mieux qu'une redirection inexplicable.
  if (error) throw new Error(`Lecture de la boutique impossible : ${error.message}`);

  return data;
});

export const getCategories = cache(async (topLevelOnly = true) => {
  const supabase = await createClient();
  let query = supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (topLevelOnly) query = query.is("parent_id", null);

  const { data } = await query;
  return data ?? [];
});

/** Bandeau contextuel de l'accueil : boutiques ouvertes + prochain direct. */
export const getMallStatus = cache(async () => {
  const supabase = await createClient();

  const [openShops, totalShops, nextLive] = await Promise.all([
    supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("is_open_now", true),
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase
      .from("lives")
      .select("id, title, scheduled_at, status, shop:shops(name, slug)")
      .in("status", ["scheduled", "live"])
      .order("status", { ascending: true })
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    openCount: openShops.count ?? 0,
    totalCount: totalShops.count ?? 0,
    anyOpen: (openShops.count ?? 0) > 0,
    nextLive: nextLive.data,
  };
});
