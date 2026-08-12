import { NextResponse } from "next/server";

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
    },
    { headers: { "cache-control": "no-store" } },
  );
}
