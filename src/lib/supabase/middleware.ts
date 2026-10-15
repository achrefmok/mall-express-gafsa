import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import {
  ENTETE_APP,
  TRANSPORT_CONFIGURE,
  cheminCommun,
  cheminQuiDemenage,
  cheminTransport,
  estHoteTransport,
  urlTransport,
} from "@/lib/transport";

/** Préfixes réservés, avec le rôle minimal exigé. */
/*
  Accès public : ce que personne n'a besoin de connexion pour atteindre,
  même quand `app_access.public_access` vaut faux — la page de
  préparation elle-même, les écrans de connexion (un commerçant doit
  pouvoir entrer), les callbacks d'authentification, les pages légales
  qu'un magasin d'applications exige de trouver, et tout `/api/…`, dont
  chaque route porte déjà sa propre garde (jeton de cron, secret de
  webhook) — les doubler ici n'ajouterait rien.

  `/boutique` en fait partie depuis peu : un commerçant en préparation
  partage déjà le lien de sa vitrine (`BoutonPartage`) pour se faire
  connaître avant le lancement officiel. Sans cette exemption, quiconque
  ouvrait ce lien — un client qu'on cherche justement à attirer —
  retombait sur l'écran « en préparation », avec un bouton de connexion
  qui ressemblait à une demande d'identifiants : l'exact inverse de ce
  qu'une carte de partage soignée (nom de la boutique, logo, photo)
  promet en pastillant le lien.
*/
const EXEMPTS_ACCES_PUBLIC = [
  "/preparation",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/activer",
  "/auth",
  "/confidentialite",
  "/suppression-donnees",
  "/hors-ligne",
  "/api",
  "/boutique",
  // Les labos `/dev/…` (données fictives) : en développement seulement —
  // ils répondent 404 en production quoi qu'il arrive.
  ...(process.env.NODE_ENV === "production" ? [] : ["/dev"]),
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
 * L'adresse G-Mall d'un chemin, depuis l'hôte de transport : `NEXT_PUBLIC_SITE_URL`
 * en production, l'hôte sans son préfixe « taxi. » en développement.
 */
function urlGMall(request: NextRequest, chemin: string): URL {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && site) return new URL(chemin, site);
  // En local seulement : le serveur de dev de Next rend toute redirection de
  // middleware relative à sa propre origine (resolve-routes.js), si bien que
  // taxi.localhost/marketplace boucle sur lui-même. Sans effet en production,
  // où G-Mall (NEXT_PUBLIC_SITE_URL) et le transport ont deux domaines.
  const hote = (request.headers.get("host") ?? request.nextUrl.host).replace(/^taxi\./, "");
  return new URL(chemin, `${request.nextUrl.protocol}//${hote}`);
}

/**
 * Point d'entrée : aiguille entre G-Mall et l'application de transport
 * (« Taxi & Louage Gafsa », voir `src/lib/transport.ts`), puis applique la
 * session et les gardes.
 *
 * Sur l'hôte de transport, toute réponse « continuer » devient une
 * réécriture vers `/transport/<chemin>` — préchargements compris, sans quoi
 * Next mettrait en cache la page G-Mall de `/taxi` —, avec l'en-tête
 * `x-gm-app: transport` que lit le gabarit racine (manifeste, icônes,
 * écran d'ouverture).
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const transport = estHoteTransport(request.headers.get("host"));

  if (!transport) {
    // `/transport/…` n'existe que derrière la réécriture de l'autre hôte.
    if (pathname === "/transport" || pathname.startsWith("/transport/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Une fois le domaine configuré, taxi et louage vivent là-bas.
    if (TRANSPORT_CONFIGURE && cheminQuiDemenage(pathname)) {
      return NextResponse.redirect(urlTransport(`${pathname}${search}`), 308);
    }
    return traiterSession(request, false);
  }

  // Les retours « accueil » des pages taxi reprises mènent ici à l'accueil de l'application.
  if (pathname === "/accueil") return NextResponse.redirect(new URL("/", request.url));

  if (!cheminTransport(pathname) && !cheminCommun(pathname)) {
    return NextResponse.redirect(urlGMall(request, `${pathname}${search}`));
  }

  const res = await traiterSession(request, true);

  if (cheminCommun(pathname) || !res.headers.get("x-middleware-next")) return res;

  const cible = request.nextUrl.clone();
  cible.pathname = pathname === "/" ? "/transport" : `/transport${pathname}`;
  // Copie faite après la session : les cookies rafraîchis y sont déjà.
  const entetes = new Headers(request.headers);
  entetes.set(ENTETE_APP, "transport");
  const reecrit = NextResponse.rewrite(cible, { request: { headers: entetes } });
  res.cookies.getAll().forEach((c) => reecrit.cookies.set(c));
  return reecrit;
}

/**
 * Rafraîchit le jeton Supabase à chaque requête et applique les gardes de
 * route. Le rafraîchissement doit se faire ici : un Server Component ne peut
 * pas écrire de cookie, donc sans middleware la session expirerait en place.
 */
async function traiterSession(request: NextRequest, transport: boolean) {
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
    target.pathname = suite?.startsWith("/") && !suite.startsWith("//") ? suite : transport ? "/" : "/accueil";
    target.search = "";
    return NextResponse.redirect(target);
  }

  /*
    Mode préparation : tant que `public_access` vaut faux, l'application
    n'est pas un marché à visiter, c'est un chantier. Chacun n'y voit que ce
    qu'il a à y faire :
      · un commerçant reste dans `/vendeur` — gérer sa boutique, pas
        parcourir celle des autres (sa propre vitrine s'ouvre quand même,
        voir `/boutique` dans `EXEMPTS_ACCES_PUBLIC`) ;
      · un exposant reste dans `/exposant`, et l'administration Dahmani dans
        `/lelma3ardh/gestion`, même raisonnement ;
      · seule l'administration de l'application voit tout, y compris le
        côté client — c'est la prévisualisation avant lancement dont parle
        la spécification, pas un privilège de plus.
    Un visiteur anonyme ou un compte client, lui, n'a nulle part où aller
    hors des pages publiques : direction `/preparation`.
  */
  /*
    L'application de transport est ouverte à tous dès maintenant (décision du
    2026-10-15), même pendant la préparation de G-Mall. Ses pages réservées
    exigent seulement d'être connecté.
  */
  if (transport) {
    const reserve = ["/courses", "/notifications", "/profil", "/devenir-chauffeur"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (reserve && !user) {
      const login = request.nextUrl.clone();
      login.pathname = "/connexion";
      login.search = "";
      login.searchParams.set("suite", pathname);
      return NextResponse.redirect(login);
    }
    return response;
  }

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

        if (!dansSonEspace && !pageCommune) {
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
