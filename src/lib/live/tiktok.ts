/*
  Directs TikTok.

  TikTok ne propose aucun lecteur intégrable pour un direct : son greffon
  (`tiktok.com/embed/v2/<id>`) ne lit que des vidéos publiées, et le flux d'un
  direct n'est pas servi aux sites tiers. On ne relaie donc pas l'image — on
  relaie le **rendez-vous** : le spectateur ouvre le direct dans TikTok d'un
  geste, et revient ici pour le produit épinglé, la remise et le panier.

  Le lien conservé est donc celui qui ouvre le direct, et rien d'autre :
  `https://www.tiktok.com/@<compte>/live`. Sur un téléphone où TikTok est
  installé, ce lien universel ouvre l'application directement.
*/

export type TiktokUrlCheck = { ok: true; url: string } | { ok: false; error: string };

const TIKTOK_HOSTS = ["www.tiktok.com", "tiktok.com", "m.tiktok.com"];

/** `vm.tiktok.com/ZS…/`, `vt.tiktok.com/ZS…/` : liens courts du bouton « Partager ». */
const SHORT_HOSTS = ["vm.tiktok.com", "vt.tiktok.com"];

/** Un nom de compte TikTok : lettres, chiffres, `_` et `.`, 24 caractères au plus. */
const ACCOUNT_PATH = /^\/@([A-Za-z0-9._]{1,24})(?:\/|$)/;

const NOT_TIKTOK = "Ce lien n'est pas une adresse TikTok";

const NO_ACCOUNT =
  "Ce lien ne désigne aucun compte TikTok. Ouvrez votre direct dans TikTok, touchez « Partager » puis « Copier le lien » — ou collez l'adresse de votre profil, du type https://www.tiktok.com/@votrecompte.";

const SHORT_HELP =
  "Ce lien court TikTok n'a pas pu être ouvert. Collez plutôt l'adresse de votre profil, du type https://www.tiktok.com/@votrecompte.";

/** Vrai si la chaîne est une adresse TikTok, quelle que soit sa forme. */
export function isTiktokUrl(input: string): boolean {
  try {
    const { hostname } = new URL(input.trim());
    return TIKTOK_HOSTS.includes(hostname) || SHORT_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Ramène toute adresse de compte TikTok au lien de son direct.
 *
 * Profil, direct ou vidéo publiée du même compte : les trois mènent au même
 * endroit une fois réduits au compte. Un commerçant qui colle l'adresse de son
 * profil — le lien qu'il connaît par cœur — obtient donc un lien qui marche,
 * et le lien reste bon d'un direct à l'autre.
 *
 * Vérification de forme seulement : un lien court passe tel quel, c'est
 * `resolveTiktokLiveUrl` qui le déplie.
 */
export function checkTiktokLiveUrl(input: string): TiktokUrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { ok: false, error: "Lien invalide — collez l'adresse complète du direct" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Le lien doit commencer par https://" };
  }

  if (SHORT_HOSTS.includes(parsed.hostname)) {
    // Le chemin seul (`/ZSabc123/`) : le suivi éventuel n'a rien à y faire.
    if (parsed.pathname.length < 3) return { ok: false, error: NO_ACCOUNT };
    return { ok: true, url: `https://${parsed.hostname}${parsed.pathname}` };
  }

  if (!TIKTOK_HOSTS.includes(parsed.hostname)) return { ok: false, error: NOT_TIKTOK };

  const account = ACCOUNT_PATH.exec(parsed.pathname)?.[1];
  if (!account) return { ok: false, error: NO_ACCOUNT };

  return { ok: true, url: `https://www.tiktok.com/@${account}/live` };
}

const isShortLink = (url: string) => SHORT_HOSTS.includes(new URL(url).hostname);

const RESOLVER_HEADERS = {
  "user-agent": "MallExpressGafsaBot/1.0 (+https://g-mall.tn)",
  accept: "text/html,application/xhtml+xml",
} as const;

/**
 * Valide un lien de direct TikTok et le ramène à `https://www.tiktok.com/@<compte>/live`.
 *
 * Le bouton « Partager » de TikTok donne un lien court (`vm.tiktok.com/…`) :
 * on le déplie en lisant la redirection, pour retrouver le compte. Si TikTok
 * ne répond pas, le lien court est **refusé** plutôt que gardé : il désigne
 * un direct précis, et ne mènerait plus nulle part au direct suivant — alors
 * que l'adresse du compte reste valable.
 */
export async function resolveTiktokLiveUrl(input: string): Promise<TiktokUrlCheck> {
  const checked = checkTiktokLiveUrl(input);
  if (!checked.ok || !isShortLink(checked.url)) return checked;

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
      return { ok: false, error: SHORT_HELP };
    }

    if (!location) return { ok: false, error: SHORT_HELP };

    let next: string;
    try {
      next = new URL(location, current).toString();
    } catch {
      return { ok: false, error: SHORT_HELP };
    }

    const resolved = checkTiktokLiveUrl(next);
    if (!resolved.ok) return { ok: false, error: SHORT_HELP };
    if (!isShortLink(resolved.url)) return resolved;

    current = resolved.url;
  }

  return { ok: false, error: SHORT_HELP };
}

/**
 * Première adresse TikTok trouvée dans une chaîne.
 *
 * Le texte partagé par TikTok mêle une phrase d'invitation et l'adresse
 * (« Regardez le LIVE de … sur TikTok ! https://vm.tiktok.com/… »).
 */
export function firstTiktokUrl(value: string | undefined): string | null {
  if (!value) return null;
  return /https?:\/\/(?:[a-z]+\.)?tiktok\.com\/[^\s]*/i.exec(value)?.[0] ?? null;
}

/** `@compte`, pour l'affichage — `null` si le lien n'en porte pas. */
export function tiktokAccount(url: string): string | null {
  try {
    return ACCOUNT_PATH.exec(new URL(url).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
