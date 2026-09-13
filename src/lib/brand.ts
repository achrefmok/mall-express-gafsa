import "server-only";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/server";

/**
 * L'identité de l'application, en un seul endroit.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le défaut que ce module corrige
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le logo se règle depuis l'administration et vit dans `app_brand`. Mais il
 * n'était lu que par l'écran de bienvenue. L'icône installée sur le
 * téléphone, l'onglet du navigateur, l'aperçu d'un lien partagé sur WhatsApp :
 * tout cela montrait un autre dessin, figé dans `public/icons/`. Deux logos
 * pour une même marque — exactement ce qu'on cherche à éviter.
 *
 * Tout ce qui affiche le logo côté serveur passe désormais par ici.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le cache
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le logo est lu à chaque icône, chaque manifeste, chaque aperçu de partage.
 * Le relire en base à chaque fois serait absurde pour une valeur qui change
 * une fois par an. Il est gardé une heure, et l'étiquette `brand` permet à
 * l'action d'administration de le périmer à l'instant où il change.
 *
 * Client statique, sans cookie : le logo est public, et `unstable_cache`
 * interdit de toute façon de lire les cookies de la requête.
 */

export const TAG_MARQUE = "brand";

/** Le nom, écrit une fois. */
export const NOM_APPLICATION = "Mall Express Gafsa";
export const NOM_COURT = "Mall Express";

/**
 * Les teintes de la marque, recopiées des jetons de `globals.css`.
 *
 * Recopiées et non lues, parce que ceux qui les utilisent — l'icône
 * générée, l'image de partage — tournent hors de toute feuille de style.
 * Si `--color-brand` change, ces valeurs doivent suivre.
 */
export const COULEURS_MARQUE = {
  violet: "#6d4b8f", // --color-brand
  violetFonce: "#5a3a78", // --color-brand-strong
  fond: "#f4f1fa", // --color-app
  encre: "#241f2e", // --color-ink
} as const;

export const lireLogo = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const supabase = createStaticClient();
      const { data } = await supabase
        .from("app_brand")
        .select("app_logo_url")
        .eq("id", true)
        .maybeSingle();

      return data?.app_logo_url ?? null;
    } catch {
      // Base injoignable à la construction : on retombe sur l'icône du dépôt.
      return null;
    }
  },
  ["app-logo"],
  { tags: [TAG_MARQUE], revalidate: 3600 },
);
