import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { signaler } from "@/lib/signal";

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

  /*
    Son propre profil, colonnes fermées comprises.

    `select("*")` ne rend plus le téléphone, les points ni `is_banned` : depuis
    l'audit du 26 août 2026, ces colonnes sont retirées aux rôles `anon` et
    `authenticated`, faute de quoi n'importe qui moissonnait les numéros de
    toute la ville avec la clé publique. `mon_profil()` est la seule porte par
    laquelle elles ressortent, et elle ne rend que la ligne de l'appelant.
  */
  const { data } = await monProfil(supabase);
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
      /*
        Les exceptions levées par nos propres fonctions SQL (`raise exception`)
        sont rédigées en français, pour être lues : « Stock insuffisant »,
        « Boutique fermée ». Elles sont donc les seules à passer telles quelles.
      */
      return error.message;
    default:
      /*
        Tout le reste est tu.

        Un message PostgREST inconnu décrit la base : nom de colonne, nom de
        contrainte, parfois la requête. Le renvoyer au navigateur donnait à
        n'importe qui une carte du schéma, une erreur à la fois — et n'aidait
        personne, ces messages étant en anglais et écrits pour un développeur.

        Il part dans les journaux, où il sert vraiment.
      */
      signaler(error, { ou: "erreur de base non traduite", quoi: { code: error.code } });
      return "Une erreur est survenue";
  }
}

/**
 * Le profil complet de la personne connectée.
 *
 * Passe par `mon_profil()`, seule porte de sortie des colonnes fermées aux
 * rôles `anon` et `authenticated` depuis l'audit du 26 août 2026 — téléphone,
 * code de parrainage, points, `is_banned`.
 *
 * **Le repli n'est pas de la prudence excessive.** Les changements de schéma
 * sont collés à la main dans l'éditeur SQL de Supabase : il existe forcément
 * une fenêtre, entre le déploiement et le collage, où le code appelle une
 * fonction qui n'existe pas encore. Sans ce repli, cette fenêtre serait une
 * panne totale — `requireProfile` gouverne toutes les actions du site.
 *
 * Une fois le DDL passé, la seconde branche ne s'exécute plus jamais : la
 * lecture directe rend alors un profil amputé de ses colonnes fermées, ce que
 * seule la fonction sait éviter.
 */
async function monProfil(supabase: Awaited<ReturnType<typeof createClient>>) {
  const viaFonction = await supabase.rpc("mon_profil");
  if (!viaFonction.error) return { data: viaFonction.data };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null };

  const direct = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { data: direct.data };
}
