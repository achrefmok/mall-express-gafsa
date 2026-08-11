const FACEBOOK_HOSTS = ["www.facebook.com", "facebook.com", "web.facebook.com", "m.facebook.com"];

export type FacebookUrlCheck =
  | { ok: true; url: string }
  | { ok: false; error: string };

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
 * Ce module vit hors de `app/actions` : un fichier `"use server"` n'accepte
 * que des exports asynchrones, et cette fonction est purement locale.
 */
export function normalizeFacebookLiveUrl(input: string): FacebookUrlCheck {
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

  // Le chemin doit désigner une vidéo. Un lien de page ou de profil afficherait
  // une iframe vide.
  const looksLikeVideo =
    /\/(videos|video|watch|live|reel|share\/v|share\/r)(\/|$)/.test(parsed.pathname) ||
    parsed.searchParams.has("v") ||
    parsed.pathname.startsWith("/permalink.php") ||
    parsed.pathname.startsWith("/story.php");

  if (!looksLikeVideo) {
    return {
      ok: false,
      error:
        "Ce lien pointe vers une page, pas vers une vidéo. Ouvrez le direct, puis copiez son permalien (il contient /videos/, /watch ou /live).",
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
