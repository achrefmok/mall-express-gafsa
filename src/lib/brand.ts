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
 * une fois par an. L'étiquette `brand` le périme à l'instant où l'écran
 * d'administration le change.
 *
 * Une minute, et non une heure, pour le cas où il change par un autre
 * chemin — un correctif posé en base, une reprise de sauvegarde. À une
 * heure, l'application servait encore l'ancien logo longtemps après, et
 * rien dans l'interface ne permettait de comprendre pourquoi. Une lecture
 * par minute et par région ne coûte rien ; une icône qui ne change pas se
 * paie en confiance.
 *
 * Client statique, sans cookie : le logo est public, et `unstable_cache`
 * interdit de toute façon de lire les cookies de la requête.
 */

export const TAG_MARQUE = "brand";

/** Le nom, écrit une fois. */
export const NOM_APPLICATION = "G-Mall";
export const NOM_COURT = "G-Mall";

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

/** Le logo, avec l'empreinte de sa version. */
export interface Marque {
  logo: string | null;
  /** Change à chaque changement de logo, et seulement là. */
  version: string;
}

export const lireMarque = unstable_cache(
  async (): Promise<Marque> => {
    try {
      const supabase = createStaticClient();
      const { data } = await supabase
        .from("app_brand")
        .select("app_logo_url, updated_at")
        .eq("id", true)
        .maybeSingle();

      return { logo: data?.app_logo_url ?? null, version: empreinte(data?.updated_at) };
    } catch {
      // Base injoignable à la construction : on retombe sur l'icône du dépôt.
      return { logo: null, version: "0" };
    }
  },
  ["app-logo"],
  { tags: [TAG_MARQUE], revalidate: 60 },
);

/** Le logo seul, pour ceux que sa version n'intéresse pas. */
export async function lireLogo(): Promise<string | null> {
  return (await lireMarque()).logo;
}

/**
 * Une date en six caractères, à coller aux adresses des icônes.
 *
 * iOS garde l'icône d'un site dans une réserve à lui, rangée par adresse.
 * Supprimer l'application de l'écran d'accueil ne la vide pas : réinstaller
 * depuis la même adresse regrave la même image, indéfiniment. Le seul moyen
 * honnête de lui faire relire une icône est de changer son adresse — non pas
 * à chaque visite, ce qui la ferait retélécharger pour rien, mais à chaque
 * changement de logo. D'où la date du logo, et elle seule.
 */
function empreinte(date: string | null | undefined): string {
  if (!date) return "0";
  const t = Date.parse(date);
  return Number.isNaN(t) ? "0" : Math.floor(t / 1000).toString(36);
}
