import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Quel commit est réellement en ligne.
 *
 * Répond à la seule question qui compte après une poussée : « ma modification
 * est-elle déployée ? » Comparer l'apparence d'une page est trompeur — une
 * route peut manquer sans que rien ne le montre, et le middleware masque les
 * absences sous `/vendeur`.
 *
 * Les variables viennent de Vercel, qui les fournit à la construction comme à
 * l'exécution. En développement elles n'existent pas : la réponse le dit.
 *
 * Rien de confidentiel ici. Un identifiant de commit est un condensat : il ne
 * donne accès à rien, et le dépôt reste privé. C'est l'usage courant d'un point
 * d'accès de version.
 */
export function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;

  return NextResponse.json(
    {
      commit: commit ?? null,
      court: commit?.slice(0, 7) ?? null,
      branche: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
      environnement: process.env.VERCEL_ENV ?? "développement",

      /*
        L'adresse publique effectivement retenue, et d'où elle vient.

        Elle gouverne les balises canoniques, le plan de site et `robots.txt` :
        s'y tromper exclut le site de l'index sans le moindre message. La
        signaler ici permet de le constater depuis l'extérieur, en une requête,
        au lieu de lire le HTML de plusieurs pages.
      */
      adresse_publique: siteUrl(),
      sources: {
        NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
        NEXT_PUBLIC_CLIENT_URL: Boolean(process.env.NEXT_PUBLIC_CLIENT_URL),
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
        VERCEL_URL: process.env.VERCEL_URL ?? null,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
