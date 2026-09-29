import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

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

  /*
    Commerçant inscrit par Google ou Facebook.

    Le déclencheur handle_new_user lit le rôle dans les métadonnées d'un
    signUp par e-mail ; un fournisseur tiers n'en envoie aucune, et le compte
    naît client. On le promeut ici, à deux conditions : le compte vient d'être
    créé (un client ancien ne se change pas en commerçant par un paramètre
    d'adresse), et il est encore client. Le commerçant choisit ensuite le nom de
    sa boutique sur /vendeur/creer — comme après une inscription sans boutique.
  */
  if (searchParams.get("role") === "vendor") {
    /*
      Même verrou que `signUp()` côté e-mail : tant que l'accès public est
      fermé, personne ne devient commerçant par ce chemin, quel que soit ce
      que porte l'adresse de retour. `?role=vendor` vient normalement du
      formulaire d'inscription — mais cette route est un point d'entrée HTTP
      à part entière, joignable sans être jamais passé par cet écran.
    */
    const { data: acces } = await supabase.from("app_access").select("public_access").eq("id", true).maybeSingle();
    const ouvert = acces?.public_access ?? false;

    const {
      data: { user: nouveau },
    } = await supabase.auth.getUser();

    const recent = ouvert && nouveau && Date.now() - new Date(nouveau.created_at).getTime() < 15 * 60_000;
    if (nouveau && recent) {
      const admin = createAdminClient();
      const { data: p } = await admin.from("profiles").select("role").eq("id", nouveau.id).maybeSingle();
      if (p?.role === "client") {
        await admin.from("profiles").update({ role: "vendor" }).eq("id", nouveau.id);
        return NextResponse.redirect(new URL("/vendeur/creer", origin));
      }
    }
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
