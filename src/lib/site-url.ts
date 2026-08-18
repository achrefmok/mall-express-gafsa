import "server-only";

/**
 * L'adresse publique du site, telle qu'elle doit apparaître aux moteurs.
 *
 * Elle sert aux balises canoniques, au plan de site, à `robots.txt` et aux
 * adresses de retour d'authentification. S'y tromper ne casse rien de visible —
 * et c'est bien le danger : pendant des semaines, ce projet a annoncé
 * `http://localhost:3000` en balise canonique, ce qui revient à dire à Google
 * « la vraie page est ailleurs, ne référence pas celle-ci ». Le site était
 * exclu de l'index par sa propre configuration, sans le moindre message d'erreur.
 *
 * L'ordre de recherche va du plus explicite au plus automatique :
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — le réglage volontaire, qui prime toujours ;
 *   2. `NEXT_PUBLIC_CLIENT_URL` — sur l'espace vendeur, la vitrine publique est
 *      l'autre hébergement, et c'est lui qu'il faut désigner ;
 *   3. `VERCEL_PROJECT_PRODUCTION_URL` — fourni par Vercel, sans intervention.
 *      C'est le filet : même sans aucun réglage, le site s'annonce correctement ;
 *   4. `localhost` — le développement, et lui seul.
 *
 * Les variantes de préversion sont volontairement ignorées : une balise
 * canonique doit désigner l'adresse de production, jamais celle d'un
 * déploiement temporaire qui disparaîtra.
 */
/**
 * Une adresse locale n'est jamais publiable.
 *
 * `NEXT_PUBLIC_SITE_URL` valait `http://localhost:3000` en production : la valeur
 * du fichier d'exemple, recopiée telle quelle dans le tableau de bord. Elle était
 * donc « définie », et primait sur tout le reste — en annonçant aux moteurs une
 * adresse qu'ils ne peuvent pas atteindre.
 *
 * Hors développement, une telle valeur est écartée au lieu d'être obéie. Un
 * réglage explicite doit primer, mais pas jusqu'à l'absurde.
 */
function publiable(value: string | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;

  const local = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(url);
  if (local && process.env.VERCEL_ENV) return null;

  return url;
}

function firstUsable(): string {
  return (
    publiable(process.env.NEXT_PUBLIC_SITE_URL) ??
    publiable(process.env.NEXT_PUBLIC_CLIENT_URL) ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : null) ??
    "http://localhost:3000"
  );
}

/** Sans barre oblique finale : toutes les concaténations en dépendent. */
export function siteUrl(): string {
  return firstUsable().replace(/\/+$/, "");
}
