import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co").hostname;
  } catch {
    return "placeholder.supabase.co";
  }
})();

/**
 * En-têtes de sécurité. `frame-src` autorise Facebook : l'écran Live peut
 * relayer un direct Facebook (source `facebook`) via le plugin vidéo officiel.
 */
/*
  L'encadrement est verrouillé en production, ouvert en développement.

  `X-Frame-Options` et `frame-ancestors` empêchent une page tierce d'afficher ce
  site dans un cadre invisible sous ses propres boutons — un détournement de clic
  qui ferait valider une commande ou un changement de mot de passe à l'insu du
  client. La protection est indispensable en ligne.

  Sur `localhost`, elle n'a aucun objet : personne ne va piéger une page servie
  par la machine du développeur. Elle empêchait en revanche les outils de
  prévisualisation mobile de fonctionner — ils chargent le site dans une iframe
  depuis leur propre page —, ce qui coûtait un aller-retour vers les outils du
  navigateur à chaque vérification de mise en page.

  La distinction se fait à la construction : un déploiement Vercel est toujours
  en `production`, et ne peut donc pas hériter de l'assouplissement.
*/
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  ...(isDev ? [] : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    /*
      camera/microphone requis pour la diffusion live depuis l'appareil du
      vendeur.

      `autoplay` doit être accordé explicitement à Facebook. Sans mention, la
      liste par défaut de cette permission est `self` — qui n'inclut pas
      l'iframe du greffon vidéo. Le `allow="autoplay"` porté par l'iframe ne
      peut déléguer que ce que le document parent possède déjà pour cette
      origine, et les navigateurs mobiles appliquent la règle bien plus
      strictement que ceux de bureau : le direct relayé y restait muet et noir
      là où il démarrait sur un ordinateur.
    */
    value:
      'camera=(self), microphone=(self), geolocation=(self), payment=(), autoplay=(self "https://www.facebook.com")',
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      isDev ? "frame-ancestors *" : "frame-ancestors 'self'",
      /*
        `unsafe-inline` reste : Next injecte les scripts d'hydratation en ligne,
        et rien ne permet de s'en passer sans nonce par requête — ce qui
        supposerait un rendu dynamique de chaque page.

        `unsafe-eval`, en revanche, ne sert qu'au développement : c'est le
        rechargement à chaud qui évalue du code à la volée. Le laisser en
        production offrait à un script injecté un outil qu'il n'aurait pas eu
        autrement, pour aucun bénéfice — et c'est précisément l'écart qui aurait
        aggravé l'évasion de balise trouvée sur les fiches produit.
      */
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net"
        : "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      // Cairo est servie depuis notre domaine via next/font : aucun hôte tiers.
      "font-src 'self' data:",
      /*
        Les tuiles de la carte viennent d'OpenStreetMap. Choix délibéré plutôt
        qu'un service commercial : gratuit, sans clé, et suffisant pour situer
        des taxis dans une ville.

        L'hôte est listé sous ses deux formes. Le joker `*.tile…` ne couvre pas
        `tile.openstreetmap.org` lui-même — une source jokerisée exige au moins
        une étiquette devant — et c'est précisément l'hôte canonique depuis
        qu'OpenStreetMap a déprécié la répartition sur a/b/c.
      */
      `img-src 'self' data: blob: https://${supabaseHost} https://*.fbcdn.net https://scontent.xx.fbcdn.net https://tile.openstreetmap.org https://*.tile.openstreetmap.org`,
      /*
        Les tuiles figurent aussi ici, et ce n'est pas une redondance.

        Le service worker intercepte les images et les redemande lui-même par
        `fetch()`. Une requête `fetch` relève de `connect-src`, jamais de
        `img-src`, et le worker hérite de la CSP du document. Autoriser l'hôte
        aux images ne suffisait donc pas : la balise passait le contrôle, la
        reprise par le worker échouait juste derrière, et la carte restait grise
        avec un « no-response » pour seule trace.

        Le principe vaut pour tout hôte d'images tierces que le worker mettra en
        cache : les deux directives vont par paire.
      */
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://accounts.google.com https://www.facebook.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://router.project-osrm.org`,
      "media-src 'self' blob: https:",
      /*
        Le greffon vidéo change d'hôte selon l'appareil, et il faut le suivre.

        Mesuré sur `www.facebook.com/plugins/video.php`, même vidéo, seul
        l'agent change :

          iPhone  → 302 vers m.facebook.com
          iPad    → 302 vers m.facebook.com
          Android → 200, aucune redirection
          bureau  → 200, aucune redirection

        `frame-src` gouverne aussi les redirections d'une iframe. En ne listant
        que `www` et `web`, on bloquait donc la redirection sur iOS : l'iframe
        restait vide, et le spectateur voyait un écran noir sans le moindre
        élément de lecteur — ni bouton, ni image, ni message. Sur ordinateur et
        sur Android, sans redirection, tout fonctionnait. D'où un défaut visible
        des seuls iPhone, longtemps pris pour un problème de mise en page.

        Le joker sur `facebook.com` est délibéré : nous intégrons déjà le
        greffon de Facebook, et énumérer ses hôtes nous a déjà coûté cette
        panne. Un hôte régional ou une future variante ne la ramènera pas.
        Le lecteur servi par `m.facebook.com` est complet — vérifié, 65 Ko
        avec `dash_manifest` et une adresse `fbcdn.net/v/`.
      */
      "frame-src 'self' https://*.facebook.com https://accounts.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  /*
    Le dossier de sortie peut être déplacé le temps d'une vérification.

    Une construction lancée pendant qu'un serveur tourne sur ce même dossier
    réécrit « .next » sous ses pieds : les feuilles de style repartent en
    « text/plain », la page s'affiche nue, et l'on croit à une régression qui
    n'existe pas. La mésaventure a déjà invalidé une campagne de mesures
    entière.

    `NEXT_DIST_DIR=.next-verif npm run build` construit donc à côté, sans
    toucher à ce qui est servi. Vercel ne définit pas la variable et retrouve le
    comportement par défaut.

    Un détail à connaître : Next réécrit `tsconfig.json` au passage pour y
    déclarer les types du dossier de sortie. C'est sans conséquence, mais cela
    salit l'état Git — il faut le remettre en place après la vérification.
  */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Sans cela, Next remonte jusqu'au premier package-lock.json trouvé dans
  // les dossiers parents et prend une racine d'espace de travail erronée.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
    ],
    formats: ["image/avif", "image/webp"],

    /*
      Trente jours plutôt qu'une minute.

      Next retient une image optimisée soixante secondes par défaut, puis la
      revalide. C'est le bon réglage pour une image dont l'URL est stable et le
      contenu changeant — un logo servi depuis `/images/logo.png`.

      Ce n'est pas notre cas : les photos de produits sont stockées sous un
      identifiant aléatoire, et modifier une photo produit une nouvelle URL.
      L'adresse et le contenu naissent et meurent ensemble. On payait donc une
      revalidation permanente pour une donnée immuable par construction.
    */
    minimumCacheTTL: 2_592_000,
  },
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js"],
  },
  /*
    La présentation a d'abord vécu sur /presentation, avant de devenir la
    racine du site. L'alias reste, pour les liens déjà partagés.

    Ici plutôt que dans une page : une `permanentRedirect()` de composant part
    dans la charge RSC, avec un statut HTTP 200 — le navigateur suit, mais un
    robot d'indexation voit une page vide. Déclarée dans la configuration,
    c'est un vrai 308, et le référencement est transféré vers « / ».
  */
  async redirects() {
    return [{ source: "/presentation", destination: "/", permanent: true }];
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",

  /*
    L'écran hors ligne, mis en cache dès l'installation.

    Le `fallbacks` du service worker ne sait servir qu'une entrée *préchargée* :
    il appelle `matchPrecache("/hors-ligne")`. Or le manifeste de préchargement
    que génère @serwist/next ne liste que les fichiers produits par la
    construction — le fragment JavaScript de la page en fait partie, jamais son
    document HTML. Sans la ligne ci-dessous, `matchPrecache` ne trouve rien, le
    repli ne rend rien du tout, et chaque navigation en échec ressort en
    « no-response » dans la console au lieu d'afficher l'écran hors ligne.

    La révision suit le commit : chaque déploiement remplace la copie en cache.

    La page lit la langue dans un cookie ; la copie enregistrée est donc celle
    de la langue active au moment de l'installation. Acceptable pour un écran de
    repli de trois lignes — la vraie page, elle, reste traduite.
  */
  additionalPrecacheEntries: [
    { url: "/hors-ligne", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  ],
});

export default withSerwist(nextConfig);
