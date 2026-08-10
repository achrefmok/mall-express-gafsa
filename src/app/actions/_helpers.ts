import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** Réponse uniforme des Server Actions : jamais de `throw` vers le client. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function done(): { ok: true } {
  return { ok: true };
}

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

/**
 * Récupère l'utilisateur courant, ou une erreur exploitable.
 * `getUser()` revalide le jeton côté serveur — indispensable avant toute
 * écriture.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "Authentification requise" } as const;
  }
  return { supabase, user, error: null } as const;
}

export async function requireProfile(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; profile: Profile; error: null }
  | { supabase: Awaited<ReturnType<typeof createClient>>; profile: null; error: string }
> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { supabase, profile: null, error: error! };

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!data) return { supabase, profile: null, error: "Profil introuvable" };
  if (data.is_banned) return { supabase, profile: null, error: "Compte suspendu" };

  return { supabase, profile: data, error: null };
}

/** Vendeur propriétaire d'une boutique (approuvée ou non). */
export async function requireShopOwner() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return { supabase, profile: null, shop: null, error: error! };

  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!shop) return { supabase, profile, shop: null, error: "Aucune boutique associée" };
  return { supabase, profile, shop, error: null };
}

export async function requireAdmin() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return { supabase, profile: null, error: error! };
  if (profile.role !== "admin") return { supabase, profile: null, error: "Accès réservé" };
  return { supabase, profile, error: null };
}

/**
 * Messages PostgREST traduits pour l'interface. Les exceptions levées par les
 * fonctions SQL (`raise exception`) remontent dans `message` : elles sont déjà
 * rédigées en français, on les laisse passer.
 */
export function readableError(error: { message: string; code?: string } | null): string {
  if (!error) return "Une erreur est survenue";

  switch (error.code) {
    case "23505":
      return "Cet élément existe déjà";
    case "23503":
      return "Référence introuvable";
    case "42501":
      return "Vous n'avez pas les droits nécessaires";
    case "P0001":
      return error.message;
    default:
      return error.message || "Une erreur est survenue";
  }
}
