import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Point d'atterrissage OAuth et confirmation d'e-mail.
 * Échange le code contre une session, puis oriente selon le rôle.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const suite = searchParams.get("suite");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    const url = new URL("/connexion", origin);
    url.searchParams.set("erreur", errorDescription);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/connexion", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/connexion", origin);
    url.searchParams.set("erreur", "Lien expiré ou déjà utilisé");
    return NextResponse.redirect(url);
  }

  // Redirection interne uniquement : un `suite` absolu permettrait à un tiers
  // de rediriger la session fraîchement ouverte vers son propre domaine.
  if (suite && suite.startsWith("/") && !suite.startsWith("//")) {
    return NextResponse.redirect(new URL(suite, origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination = "/accueil";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "vendor") destination = "/vendeur";
    else if (profile?.role === "admin") destination = "/admin";
  }

  return NextResponse.redirect(new URL(destination, origin));
}
