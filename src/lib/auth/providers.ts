import "server-only";

import { unstable_cache } from "next/cache";

export type OAuthProvider = "google" | "facebook";

const ALL: OAuthProvider[] = ["google", "facebook"];

/**
 * Fournisseurs tiers réellement activés sur le projet Supabase.
 *
 * Google et Facebook s'activent dans le tableau de bord, pas dans le code :
 * il faut un identifiant client et un secret obtenus chez Google Cloud et
 * chez Meta. Tant que ce n'est pas fait, `signInWithOAuth` échoue avec
 * « Unsupported provider ».
 *
 * Plutôt que d'afficher deux boutons qui mènent à une erreur, on interroge
 * `/auth/v1/settings` — point d'accès public, sans authentification — et on
 * n'affiche que ce qui fonctionne. Résultat en cache cinq minutes : le
 * réglage change une fois dans la vie du projet.
 */
/**
 * Forme attendue de l'identifiant client, par fournisseur.
 *
 * Un fournisseur peut être « activé » dans Supabase et pourtant inutilisable :
 * il suffit d'avoir collé autre chose que l'identifiant client dans le champ.
 * Le visiteur atterrit alors sur une page d'erreur du fournisseur — « ID d'app
 * non valide » chez Facebook — d'où il ne peut même pas revenir ici.
 */
const CLIENT_ID_SHAPE: Record<OAuthProvider, RegExp> = {
  facebook: /^\d{15,17}$/, // App ID Meta : un nombre
  google: /^[\w-]+\.apps\.googleusercontent\.com$/,
};

/**
 * L'identifiant client que Supabase transmettra est-il plausible ?
 *
 * On suit la redirection d'autorisation sans l'exécuter et on lit le
 * `client_id`. Ce n'est pas un secret : il voyage dans l'URL du navigateur à
 * chaque connexion.
 *
 * En cas de doute — réseau, réponse inattendue — on répond `true` : mieux vaut
 * un bouton qui pourrait marcher qu'une connexion supprimée par erreur.
 */
async function clientIdLooksValid(base: string, key: string, provider: OAuthProvider) {
  try {
    const response = await fetch(
      `${base}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(base)}`,
      { headers: { apikey: key }, redirect: "manual", signal: AbortSignal.timeout(5_000) },
    );

    const location = response.headers.get("location");
    if (!location) return true;

    const clientId = new URL(location).searchParams.get("client_id");
    if (clientId === null) return true;

    return CLIENT_ID_SHAPE[provider].test(clientId);
  } catch {
    return true;
  }
}

export const enabledOAuthProviders = unstable_cache(
  async (): Promise<OAuthProvider[]> => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !key) return [];

    try {
      const response = await fetch(`${base}/auth/v1/settings`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return [];

      const settings: { external?: Record<string, boolean> } = await response.json();
      const declared = ALL.filter((provider) => settings.external?.[provider] === true);

      const usable = await Promise.all(
        declared.map(async (provider) =>
          (await clientIdLooksValid(base, key, provider)) ? provider : null,
        ),
      );

      return usable.filter((provider): provider is OAuthProvider => provider !== null);
    } catch {
      // Réglages injoignables : on masque les boutons plutôt que d'en
      // proposer un qui échouerait. La connexion par e-mail reste offerte.
      return [];
    }
  },
  ["auth-oauth-providers"],
  { revalidate: 300 },
);
