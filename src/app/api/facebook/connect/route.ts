import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireShopOwner } from "@/app/actions/_helpers";
import { authorizeUrl, facebookConfigured, OAUTH_STATE_COOKIE } from "@/lib/live/facebook-graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Départ de la liaison « ma page Facebook ».
 *
 * Le paramètre `state` est un aléa déposé en parallèle dans un cookie
 * httpOnly. Au retour, les deux doivent coïncider : sans cela, un tiers
 * pourrait faire relier *sa* page à la boutique d'un commerçant en lui
 * faisant ouvrir un lien préparé.
 *
 * La boutique n'est pas transportée dans l'état — elle est redéduite de la
 * session au retour. Un identifiant dans l'URL serait modifiable.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const fail = (reason: string) => {
    const url = new URL("/vendeur/reglages", origin);
    url.searchParams.set("facebook", "erreur");
    url.searchParams.set("motif", reason);
    return NextResponse.redirect(url);
  };

  if (!facebookConfigured()) {
    return fail("Le relais Facebook n'est pas configuré sur ce site.");
  }

  const { shop } = await requireShopOwner();
  if (!shop) return fail("Connectez-vous avec votre compte vendeur.");

  const state = randomBytes(24).toString("hex");

  (await cookies()).set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // « lax » et non « strict » : le cookie doit survivre au retour depuis Facebook
    path: "/api/facebook",
    maxAge: 600,
  });

  return NextResponse.redirect(
    authorizeUrl(`${origin}/api/facebook/callback`, state),
  );
}
