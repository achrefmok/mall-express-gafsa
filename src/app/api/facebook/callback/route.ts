import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireShopOwner } from "@/app/actions/_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import {
  GraphError,
  OAUTH_STATE_COOKIE,
  pagesForCode,
  subscribePage,
} from "@/lib/live/facebook-graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Retour du dialogue Facebook.
 *
 * On échange le code contre les pages du commerçant, on retient la première
 * — la quasi-totalité des boutiques n'en a qu'une — puis on abonne cette page
 * au webhook `live_videos`.
 *
 * Le jeton de page part directement dans `shop_facebook_pages`, écrite avec la
 * clé secrète. Cette table n'a aucune policy pour `anon` ni `authenticated` :
 * même le propriétaire de la boutique ne peut pas relire son jeton par l'API.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  const back = (status: string, reason?: string) => {
    const url = new URL("/vendeur/reglages", origin);
    url.searchParams.set("facebook", status);
    if (reason) url.searchParams.set("motif", reason);
    return NextResponse.redirect(url);
  };

  // ─── Le commerçant a refusé, ou Facebook a renvoyé une erreur ─────────
  if (params.get("error")) {
    return back(
      "annule",
      params.get("error_description") ?? "Autorisation refusée sur Facebook.",
    );
  }

  // ─── Anti-CSRF : l'état doit correspondre au cookie déposé au départ ──
  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);

  const state = params.get("state");
  if (!expected || !state || state !== expected) {
    return back("erreur", "Demande expirée ou invalide. Recommencez la connexion.");
  }

  const code = params.get("code");
  if (!code) return back("erreur", "Facebook n'a pas renvoyé de code d'autorisation.");

  const { shop } = await requireShopOwner();
  if (!shop) return back("erreur", "Connectez-vous avec votre compte vendeur.");

  try {
    const pages = await pagesForCode(code, `${origin}/api/facebook/callback`);

    if (pages.length === 0) {
      return back(
        "erreur",
        "Aucune page Facebook n'est rattachée à ce compte. Le relais fonctionne avec une page, pas avec un profil personnel.",
      );
    }

    const page = pages[0];
    const subscribed = await subscribePage(page.id, page.token);

    const admin = createAdminClient();
    const { error } = await admin.from("shop_facebook_pages").upsert(
      {
        shop_id: shop.id,
        page_id: page.id,
        page_name: page.name,
        page_token: page.token,
        is_subscribed: subscribed,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "shop_id" },
    );

    if (error) {
      console.error("Enregistrement de la page Facebook impossible", error.message);
      return back("erreur", "Enregistrement impossible. Réessayez dans un instant.");
    }

    // Sans abonnement, le relais reste manuel : la console propose alors
    // « Vérifier maintenant ». L'interface le dit, plutôt que de laisser
    // croire à une détection qui n'aura pas lieu.
    return back(subscribed ? "connecte" : "connecte-sans-webhook");
  } catch (cause) {
    const detail = cause instanceof GraphError ? cause.message : "Erreur inattendue";
    console.error("Liaison Facebook échouée", detail);

    return back(
      "erreur",
      /permission|scope|approved/i.test(detail)
        ? "Les autorisations de lecture des pages ne sont pas encore accordées à l'application par Meta."
        : "Facebook a refusé la demande. Réessayez dans un instant.",
    );
  }
}
