const FACEBOOK_HOSTS = ["www.facebook.com", "facebook.com", "web.facebook.com", "m.facebook.com"];

export type FacebookUrlCheck =
  | { ok: true; url: string }
  | { ok: false; error: string };

/*
  Tout lien issu du bouton « Partager ».

  Le segment de type est décoratif : seul l'identifiant désigne le contenu.
  Vérifié sur un même identifiant, les quatre formes mènent à la même vidéo —

    /share/14jA9LH8WJV/    /share/p/14jA9LH8WJV/
    /share/v/14jA9LH8WJV/  /share/r/14jA9LH8WJV/

  — d'où la forme large ci-dessous. Deviner la nature du contenu d'après ce
  chemin serait vain : `p` (publication) sert aussi à une vidéo, et un partage
  sans segment du tout est courant. C'est la cible, une fois dépliée, qui dit
  s'il y a une vidéo au bout.
*/
const SHARE_PATH = /^\/share\//;

/**
 * Valide et normalise un permalien de direct Facebook.
 *
 * Le greffon vidéo de Facebook n'accepte que des permaliens complets sur un
 * domaine `facebook.com`. Deux formes échouent silencieusement — l'iframe
 * s'affiche noire, sans message :
 *
 *   · les liens courts `fb.watch/…`, que le greffon ne résout pas ;
 *   · les adresses `m.facebook.com`, qu'il refuse.
 *
 * On les rejette donc en indiquant la manœuvre à faire, plutôt que de les
 * accepter et de laisser le vendeur devant un carré noir en pleine vente.
 *
 * Les paramètres de suivi (`fbclid`, `mibextid`) sont retirés : ils ne servent
 * à rien dans une iframe et allongent l'URL stockée.
 *
 * Vérification de forme seulement, et volontairement non exportée : un lien de
 * partage `/share/v/…` la passe alors que le greffon ne sait pas l'afficher.
 * Tout appelant doit passer par `resolveFacebookLiveUrl`, qui la complète.
 */
function checkFacebookLiveUrlShape(input: string): FacebookUrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { ok: false, error: "Lien invalide — collez l'adresse complète de la vidéo" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Le lien doit commencer par https://" };
  }

  if (parsed.hostname === "fb.watch") {
    return {
      ok: false,
      error:
        "Les liens courts fb.watch ne peuvent pas être intégrés. Ouvrez ce lien dans un navigateur, puis copiez l'adresse complète qui commence par https://www.facebook.com/",
    };
  }

  if (!FACEBOOK_HOSTS.includes(parsed.hostname)) {
    return { ok: false, error: "Ce lien n'est pas une adresse Facebook" };
  }

  // `m.facebook.com` est refusé par le greffon : on le ramène au domaine complet.
  const host = parsed.hostname === "m.facebook.com" ? "www.facebook.com" : parsed.hostname;

  /*
    Le lien doit désigner **une** vidéo, et pas seulement en avoir l'air.

    Se contenter d'un mot du chemin ne suffit pas : `facebook.com/watch/live/`
    contient bien « watch » et « live », mais c'est le répertoire des directs de
    Facebook — aucun identifiant, donc une iframe vide et un carré noir en pleine
    vente. Même piège avec `/watch/`, `/videos/` ou `/reel/` laissés nus.

    On exige donc l'identifiant lui-même, sous l'une de ses trois formes.
  */
  const hasVideoId =
    // `/<page>/videos/<id>`, `/reel/<id>` — l'identifiant est dans le chemin
    /\/(?:videos?|reel)\/[A-Za-z0-9._-]+/.test(parsed.pathname) ||
    // `/watch/?v=<id>`, `/video.php?v=<id>`, `/watch/live/?v=<id>`
    Boolean(parsed.searchParams.get("v")) ||
    // `/permalink.php` et `/story.php` le portent en paramètre
    Boolean(parsed.searchParams.get("story_fbid")) ||
    // Un lien de partage ne dit rien de son contenu : `resolveFacebookLiveUrl`
    // le déplie, et c'est la cible qui repasse ici pour être jugée.
    SHARE_PATH.test(parsed.pathname);

  if (!hasVideoId) {
    return {
      ok: false,
      error:
        "Ce lien ne désigne aucune vidéo précise. Ouvrez le direct lui-même, puis copiez l'adresse de la barre du navigateur — elle contient /videos/ suivi d'un numéro, ou ?v= suivi d'un numéro.",
    };
  }

  const clean = new URL(`https://${host}${parsed.pathname}`);

  /*
    On ne garde que les paramètres qui désignent la vidéo, et on écarte le
    suivi (`fbclid`, `mibextid`, `rdid`…).

    `story_fbid` et `id` comptent autant que `v` : sur `permalink.php` et
    `story.php`, ce sont eux qui portent l'identifiant — le chemin seul ne
    désigne rien, et une URL amputée de ces paramètres afficherait une iframe
    vide.
  */
  for (const key of ["v", "story_fbid", "id"]) {
    const value = parsed.searchParams.get(key);
    if (value) clean.searchParams.set(key, value);
  }

  return { ok: true, url: clean.toString() };
}

/* ─── Liens de partage ───────────────────────────────────────────────────── */

const isShareLink = (url: string) => SHARE_PATH.test(new URL(url).pathname);

/*
  Il faut annoncer ce que nous sommes — un programme — et surtout ne pas se
  faire passer pour un navigateur. Mesuré sur `/share/v/198Y1GJ8Na/` :

    · agent Chrome, sans autre en-tête ............ 400 Bad Request
    · agent Chrome + `Sec-Fetch-Mode: navigate` ... 302 vers le permalien
    · agent propre, non navigateur ................ 302 vers le permalien
    · agent vide .................................. 302 vers /unsupportedbrowser

  Facebook vérifie la cohérence : un agent de navigateur sans les en-têtes
  `Sec-Fetch-*` qui l'accompagnent toujours est rejeté. Et cette voie nous est
  fermée de toute façon — `Sec-` est un préfixe interdit par la spécification
  Fetch, `undici` retire l'en-tête en silence et Node reçoit le 400.

  Un agent qui dit la vérité obtient la redirection sans détour, et sans avoir
  à usurper l'identité de qui que ce soit.
*/
const RESOLVER_HEADERS = {
  "user-agent": "MallExpressGafsaBot/1.0 (+https://mall-express-gafsa.vercel.app)",
  accept: "text/html,application/xhtml+xml",
} as const;

const SHARE_HELP =
  "Ce lien de partage n'a pas pu être ouvert. Affichez la vidéo sur Facebook, puis copiez l'adresse de la barre du navigateur (elle contient /videos/ ou /reel/).";

/**
 * Valide un lien de direct Facebook et le ramène à son permalien canonique.
 *
 * Les liens de partage — ceux que produit le bouton « Partager », donc ceux qui
 * arrivent par la cible de partage du manifeste — sont sur le domaine
 * `facebook.com` et ressemblent à des liens vidéo, mais le greffon
 * `plugins/video.php` ne les résout pas : il renvoie une page sans vidéo, et le
 * vendeur se retrouve devant un carré noir. Mesuré sur `/share/v/198Y1GJ8Na/` :
 * la réponse du greffon fait 48 Ko et ne contient ni `playable_url`, ni
 * `dash_manifest`, ni la moindre adresse `fbcdn.net/v/` — là où le permalien
 * canonique en fait 188 Ko et les donne toutes.
 *
 * Un lien de partage n'est donc pas refusé mais déplié : une requête, la
 * redirection lue dans `Location`, et on repasse la cible par la vérification
 * de forme — ce qui écarte au passage `rdid` et `share_url`, et rejette les
 * redirections vers l'écran de connexion ou vers `/unsupportedbrowser`.
 *
 * Trois sauts au plus : un seul suffit depuis `www.facebook.com`, deux depuis
 * `web.facebook.com`, et une boucle éventuelle ne doit pas nous retenir.
 */
export async function resolveFacebookLiveUrl(input: string): Promise<FacebookUrlCheck> {
  const checked = checkFacebookLiveUrlShape(input);
  if (!checked.ok || !isShareLink(checked.url)) return checked;

  let current = checked.url;

  for (let hop = 0; hop < 3; hop++) {
    let location: string | null;
    try {
      const response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        headers: RESOLVER_HEADERS,
        signal: AbortSignal.timeout(6_000),
      });
      location = response.headers.get("location");
    } catch {
      // Réseau absent, Facebook injoignable, ou délai dépassé.
      return { ok: false, error: SHARE_HELP };
    }

    if (!location) return { ok: false, error: SHARE_HELP };

    let next: string;
    try {
      next = new URL(location, current).toString();
    } catch {
      return { ok: false, error: SHARE_HELP };
    }

    const resolved = checkFacebookLiveUrlShape(next);
    if (resolved.ok && !isShareLink(resolved.url)) return resolved;

    /*
      La cible existe mais ne convient pas — une publication sans vidéo, un
      profil, l'écran de connexion. Son propre refus est plus précis que le
      nôtre : il nomme ce qui a été trouvé au bout du lien.
    */
    if (!resolved.ok) return resolved;

    current = resolved.url; // encore un lien de partage : on continue
  }

  return { ok: false, error: SHARE_HELP };
}
