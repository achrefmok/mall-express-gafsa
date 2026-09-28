import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/** Préfixes réservés, avec le rôle minimal exigé. */
/*
  Accès public : ce que personne n'a besoin de connexion pour atteindre,
  même quand `app_access.public_access` vaut faux — la page de
  préparation elle-même, les écrans de connexion (un commerçant doit
  pouvoir entrer), les callbacks d'authentification, les pages légales
  qu'un magasin d'applications exige de trouver, et tout `/api/…`, dont
  chaque route porte déjà sa propre garde (jeton de cron, secret de
  webhook) — les doubler ici n'ajouterait rien.
*/
const EXEMPTS_ACCES_PUBLIC = [
  "/preparation",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/auth",
  "/confidentialite",
  "/suppression-donnees",
  "/hors-ligne",
  "/api",
];

function exemptAccesPublic(pathname: string): boolean {
  return EXEMPTS_ACCES_PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const GUARDED: Array<{ prefix: string; role: "client" | "vendor" | "admin" | "dahmani" | "exhibitor" }> = [
  { prefix: "/vendeur", role: "vendor" },
  { prefix: "/admin", role: "admin" },
  /*
    L'espace de Société Dahmani. Il vit hors de `/admin` exprès : un
    administrateur Dahmani n'est pas un administrateur de l'application, et
    le mettre sous le même préfixe aurait fait dépendre la séparation d'une
    exception dans la garde — le genre d'exception qu'un jour on oublie.
  */
  { prefix: "/lelma3ardh/gestion", role: "dahmani" },
  /*
    L'espace du titulaire d'un stand — son propre rôle, distinct du vendeur
    et de l'administration Dahmani qui l'a créé. Même raisonnement que pour
    « dahmani » juste au-dessus : un exposant n'est ni vendeur ni membre de
    l'administration, et ne doit hériter d'aucun des deux par accident.
  */
  { prefix: "/exposant", role: "exhibitor" },
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
    Next.js précharge silencieusement les liens visibles (`<Link>` sans
    `prefetch={false}`) : chaque tuile du menu déclenche une requête vers cet
    intergiciel, en plus de celle de la page qu'on regarde. Deux jetons de
    rafraîchissement Supabase sont à usage unique — si la revalidation du
    jeton ci-dessus tombe pile sur cette fenêtre-là, un préchargement peut
    voir `user` à `null` alors que la session, elle, est valide.
    Next met en cache la réponse du préchargement, redirection comprise : un
    utilisateur qui clique juste après tombe sur `/connexion` sans y être
    pour autant déconnecté.

    Une requête de préchargement ne doit donc jamais décider seule d'une
    redirection d'authentification — la vraie navigation, elle, refera la
    demande sans l'en-tête et sera revalidée sur un jeton à jour.
  */
  if (request.headers.get("next-router-prefetch") === "1") {
    return response;
  }

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

  /*
    Mode préparation : tant que `public_access` vaut faux, l'application
    n'est pas un marché à visiter, c'est un chantier. Chacun n'y voit que ce
    qu'il a à y faire :
      · un commerçant reste dans `/vendeur` — gérer sa boutique, pas
        parcourir celle des autres ;
      · un exposant reste dans `/exposant`, et l'administration Dahmani dans
        `/lelma3ardh/gestion`, même raisonnement ;
      · seule l'administration de l'application voit tout, y compris le
        côté client — c'est la prévisualisation avant lancement dont parle
        la spécification, pas un privilège de plus.
    Un visiteur anonyme ou un compte client, lui, n'a nulle part où aller :
    direction `/preparation`.
  */
  if (!exemptAccesPublic(pathname)) {
    const { data: reglages } = await supabase
      .from("app_access")
      .select("public_access")
      .eq("id", true)
      .maybeSingle();

    const public_access = reglages?.public_access ?? false;

    if (!public_access) {
      let role: string | null = null;
      if (user) {
        const { data: profil } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        role = profil?.role ?? "client";
      }

      if (role !== "admin") {
        const espace: Record<string, string> = {
          vendor: "/vendeur",
          exhibitor: "/exposant",
          dahmani_admin: "/lelma3ardh/gestion",
        };
        const racine = role ? espace[role] : undefined;
        const dansSonEspace = racine !== undefined && (pathname === racine || pathname.startsWith(`${racine}/`));
        // Réglages personnels et déconnexion : communs à tout compte connecté,
        // qu'il ait ou non un espace dédié pendant la préparation.
        const pageCommune = pathname === "/profil" || pathname.startsWith("/profil/");

        /*
          « Voir ma boutique » : un commerçant doit pouvoir constater ce que
          les clients verront, sans pour autant parcourir le reste. Seule la
          vitrine dont il est propriétaire s'ouvre — la comparaison se fait ici,
          sur le jeton validé, et non sur un paramètre que l'appelant choisit.
        */
        let saVitrine = false;
        if (role === "vendor" && user && pathname.startsWith("/boutique/")) {
          const slug = pathname.split("/")[2];
          const { data: boutique } = await supabase
            .from("shops")
            .select("id")
            .eq("owner_id", user.id)
            .eq("slug", slug)
            .maybeSingle();
          saVitrine = Boolean(boutique);
        }

        if (!dansSonEspace && !pageCommune && !saVitrine) {
          const cible = request.nextUrl.clone();
          cible.pathname = racine ?? "/preparation";
          cible.search = "";
          return NextResponse.redirect(cible);
        }
      }
    }
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
          · exhibitor — le titulaire d'un stand, ou l'une des deux
            administrations qui vient inspecter ;
          · admin — l'administration de l'application, et elle seule.
            `dahmani_admin` est explicitement dehors : c'est là toute la
            raison d'être de ce rôle.
      */
      const allowed =
        guard.role === "vendor"
          ? role === "vendor" || role === "admin"
          : guard.role === "dahmani"
            ? role === "dahmani_admin" || role === "admin"
            : guard.role === "exhibitor"
              ? role === "exhibitor" || role === "dahmani_admin" || role === "admin"
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
