import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/** Préfixes réservés, avec le rôle minimal exigé. */
const GUARDED: Array<{ prefix: string; role: "client" | "vendor" | "admin" | "dahmani" }> = [
  { prefix: "/vendeur", role: "vendor" },
  { prefix: "/admin", role: "admin" },
  /*
    L'espace de Société Dahmani. Il vit hors de `/admin` exprès : un
    administrateur Dahmani n'est pas un administrateur de l'application, et
    le mettre sous le même préfixe aurait fait dépendre la séparation d'une
    exception dans la garde — le genre d'exception qu'un jour on oublie.
  */
  { prefix: "/lelma3ardh/gestion", role: "dahmani" },
  { prefix: "/panier", role: "client" },
  { prefix: "/commandes", role: "client" },
  { prefix: "/profil", role: "client" },
  { prefix: "/free-shop/nouveau", role: "client" },
];

/**
 * Rafraîchit le jeton Supabase à chaque requête et applique les gardes de
 * route. Le rafraîchissement doit se faire ici : un Server Component ne peut
 * pas écrire de cookie, donc sans middleware la session expirerait en place.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() — et non getSession() : seul getUser() revalide le jeton
  // auprès du serveur d'authentification. getSession() fait confiance au
  // cookie, qu'un client peut forger.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  /*
    Déjà connecté : les écrans de connexion et d'inscription n'ont plus
    d'objet. Les pages le vérifiaient déjà, mais leur `redirect()` part après
    le rendu de la coque — statut 200 et charge RSC. Ici, c'est un vrai 307.

    `suite` est honoré s'il est présent : un lien « connectez-vous pour
    commander » doit mener au panier, pas à l'accueil.
  */
  if (user && (pathname === "/connexion" || pathname === "/inscription")) {
    const suite = request.nextUrl.searchParams.get("suite");
    const target = request.nextUrl.clone();
    target.pathname = suite?.startsWith("/") && !suite.startsWith("//") ? suite : "/accueil";
    target.search = "";
    return NextResponse.redirect(target);
  }

  const guard = GUARDED.find(
    (g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`),
  );

  if (guard) {
    if (!user) {
      const login = request.nextUrl.clone();
      login.pathname = "/connexion";
      login.searchParams.set("suite", pathname);
      return NextResponse.redirect(login);
    }

    if (guard.role !== "client") {
      /*
        Le rôle et la boutique en une seule requête.

        Il en fallait deux, l'une après l'autre : le rôle, puis — pour un
        vendeur — l'existence de sa boutique. Avec la revalidation du jeton qui
        précède, cela faisait **trois allers-retours réseau avant le premier
        octet** de n'importe quelle page vendeur, sur un intergiciel qui
        s'exécute à chaque navigation.

        La relation imbriquée les fusionne. Elle ne coûte rien de plus à la
        base — c'est la même jointure qu'elle aurait faite — et retire une
        latence complète du chemin critique.
      */
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, shops!shops_owner_id_fkey(id)")
        .eq("id", user.id)
        .single();

      const role = profile?.role ?? "client";
      /*
        Qui passe :
          · vendeur — un vendeur, ou un administrateur qui vient inspecter ;
          · dahmani — l'administration Dahmani, ou celle de l'application,
            qui garde tous les droits ;
          · admin — l'administration de l'application, et elle seule.
            `dahmani_admin` est explicitement dehors : c'est là toute la
            raison d'être de ce rôle.
      */
      const allowed =
        guard.role === "vendor"
          ? role === "vendor" || role === "admin"
          : guard.role === "dahmani"
            ? role === "dahmani_admin" || role === "admin"
            : role === "admin";

      if (!allowed) {
        const home = request.nextUrl.clone();
        home.pathname = "/accueil";
        home.searchParams.set("acces", "refuse");
        return NextResponse.redirect(home);
      }

      /*
        Vendeur sans boutique — inscription sans nom de boutique, ou client
        promu depuis /admin/membres. Les pages de l'espace vendeur redirigent
        déjà vers /vendeur/creer, mais après le rendu de la coque : le
        navigateur affiche brièvement le tableau de bord avant de sauter.
        Ici, la réponse est un vrai 307, sans clignotement.

        Un administrateur est exempté : il visite l'espace vendeur pour
        inspecter, pas pour ouvrir boutique.
      */
      if (guard.role === "vendor" && role === "vendor" && pathname !== "/vendeur/creer") {
        // Déjà rapportée par la requête ci-dessus : plus rien à demander.
        const boutiques = (profile?.shops ?? []) as Array<{ id: string }>;

        if (boutiques.length === 0) {
          const create = request.nextUrl.clone();
          create.pathname = "/vendeur/creer";
          create.search = "";
          return NextResponse.redirect(create);
        }
      }
    }
  }

  return response;
}
