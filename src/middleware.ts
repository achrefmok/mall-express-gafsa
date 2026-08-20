import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { servesPath, spaceHref } from "@/lib/space";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
    Un déploiement ne sert que son espace.

    Avec `NEXT_PUBLIC_APP_SPACE` à `client`, les routes vendeur et administration
    n'existent pas ici : on renvoie vers l'hébergement qui les porte plutôt que
    de rendre une page vide. Sans adresse configurée, la redirection ramène à la
    racine — mieux vaut l'accueil qu'un écran qui ne se chargera jamais.

    La garde est avant `updateSession` : inutile de rafraîchir une session pour
    une route que ce déploiement ne rendra pas.
  */
  if (!servesPath(pathname)) {
    const target = spaceHref(pathname);
    return NextResponse.redirect(
      target.startsWith("http") ? new URL(target) : new URL("/", request.url),
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tout sauf : fichiers statiques Next, images optimisées, favicon,
     * l'atelier du service worker et les fichiers du manifeste PWA.
     *
     * `.html` et `.txt` sont exclus depuis la vérification Google Search
     * Console : ces fichiers sont servis tels quels depuis `public/`, et faire
     * passer un robot d'indexation par un rafraîchissement de session Supabase
     * n'apporte rien — ni au robot, ni au quota.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|html|txt)$).*)",
  ],
};
