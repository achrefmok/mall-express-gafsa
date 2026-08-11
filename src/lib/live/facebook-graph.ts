import "server-only";

/**
 * Client Graph API, strictement serveur.
 *
 * Tout ce qui circule ici est sensible : le secret de l'application et les
 * jetons de page, qui permettent de lire la page d'un commerçant en son nom.
 * Le `server-only` en tête fait échouer la compilation si un composant client
 * importe ce module par mégarde.
 *
 * Rien n'est facturé : la lecture des directs d'une page relève de l'usage
 * standard de la Graph API.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Cookie portant l’aléa anti-CSRF du dialogue OAuth. Déposé au départ,
 * comparé au retour. Ici plutôt que dans une route : Next n’autorise, dans un
 * `route.ts`, que l’export des gestionnaires HTTP.
 */
export const OAUTH_STATE_COOKIE = "meg-fb-oauth-state";

export const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID ?? "";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET ?? "";

/** Permissions demandées au commerçant. Aucune autre : chacune passe en revue. */
export const PAGE_SCOPES = [
  "pages_show_list", // lister ses pages
  "pages_read_engagement", // lire les vidéos de la page
  "pages_manage_metadata", // abonner la page au webhook `live_videos`
].join(",");

export function facebookConfigured(): boolean {
  return Boolean(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET);
}

/** Erreur portant un message déjà rédigé pour le commerçant. */
export class GraphError extends Error {}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number } })
    | null;

  if (!response.ok || body?.error) {
    // Le message de Facebook est en anglais et souvent technique ; on le garde
    // pour le journal, mais l'appelant choisit ce qu'il montre.
    throw new GraphError(body?.error?.message ?? `Graph API : HTTP ${response.status}`);
  }
  if (!body) throw new GraphError("Réponse illisible de Facebook");

  return body;
}

/* ─── Connexion d'une page ───────────────────────────────────────────── */

/** URL du dialogue d'autorisation, à ouvrir dans le navigateur du vendeur. */
export function authorizeUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", FACEBOOK_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", PAGE_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

/** Échange le code d'autorisation contre un jeton utilisateur. */
async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const data = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: FACEBOOK_APP_ID,
    client_secret: FACEBOOK_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });
  return data.access_token;
}

export type FacebookPage = { id: string; name: string; token: string };

/**
 * Pages administrées par le commerçant.
 *
 * Les jetons renvoyés par `/me/accounts` héritent de la durée du jeton
 * utilisateur. On échange donc d'abord ce dernier contre sa version longue
 * durée (~60 jours) : les jetons de page qui en découlent n'expirent alors
 * plus tant que le commerçant ne révoque pas l'accès.
 */
export async function pagesForCode(code: string, redirectUri: string): Promise<FacebookPage[]> {
  const shortLived = await exchangeCode(code, redirectUri);

  const { access_token: longLived } = await graph<{ access_token: string }>(
    "oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: FACEBOOK_APP_ID,
      client_secret: FACEBOOK_APP_SECRET,
      fb_exchange_token: shortLived,
    },
  );

  const { data } = await graph<{ data: Array<{ id: string; name: string; access_token: string }> }>(
    "me/accounts",
    { access_token: longLived, fields: "id,name,access_token", limit: "50" },
  );

  return (data ?? []).map((page) => ({ id: page.id, name: page.name, token: page.access_token }));
}

/* ─── Abonnement au webhook ──────────────────────────────────────────── */

/**
 * Abonne la page au champ `live_videos`.
 *
 * C'est ce qui rend le relais automatique : Facebook nous prévient au lieu
 * d'être interrogé. En cas d'échec — permission non encore approuvée par Meta
 * —, on renvoie `false` et le vendeur garde le bouton « Vérifier maintenant ».
 */
export async function subscribePage(pageId: string, pageToken: string): Promise<boolean> {
  try {
    const url = new URL(`${GRAPH}/${pageId}/subscribed_apps`);
    url.searchParams.set("access_token", pageToken);
    url.searchParams.set("subscribed_fields", "live_videos");

    const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(15_000) });
    const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return response.ok && body?.success === true;
  } catch {
    return false;
  }
}

export async function unsubscribePage(pageId: string, pageToken: string): Promise<void> {
  try {
    const url = new URL(`${GRAPH}/${pageId}/subscribed_apps`);
    url.searchParams.set("access_token", pageToken);
    await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(15_000) });
  } catch {
    // La déconnexion côté Mall Express prime : si Facebook ne répond pas, on
    // supprime quand même le lien. Le pire cas est un abonnement orphelin,
    // dont les notifications seront ignorées faute de boutique associée.
  }
}

/* ─── Lecture des directs ────────────────────────────────────────────── */

export type LiveVideo = {
  id: string;
  status: string;
  permalink: string;
  title: string;
};

/** Permalien absolu : Facebook renvoie un chemin relatif. */
function absolute(permalink: string | undefined, videoId: string): string {
  if (!permalink) return `https://www.facebook.com/watch/?v=${videoId}`;
  return permalink.startsWith("http") ? permalink : `https://www.facebook.com${permalink}`;
}

/** Les derniers directs d'une page, en cours ou terminés. */
export async function recentLiveVideos(pageId: string, pageToken: string): Promise<LiveVideo[]> {
  const { data } = await graph<{
    data: Array<{ id: string; status?: string; permalink_url?: string; title?: string }>;
  }>(`${pageId}/live_videos`, {
    access_token: pageToken,
    fields: "id,status,permalink_url,title",
    limit: "5",
  });

  return (data ?? []).map((video) => ({
    id: video.id,
    status: video.status ?? "UNKNOWN",
    permalink: absolute(video.permalink_url, video.id),
    title: video.title ?? "",
  }));
}

/** Un seul direct, par son identifiant — ce que porte le webhook. */
export async function liveVideoById(videoId: string, pageToken: string): Promise<LiveVideo | null> {
  try {
    const video = await graph<{
      id: string;
      status?: string;
      permalink_url?: string;
      title?: string;
    }>(videoId, { access_token: pageToken, fields: "id,status,permalink_url,title" });

    return {
      id: video.id,
      status: video.status ?? "UNKNOWN",
      permalink: absolute(video.permalink_url, video.id),
      title: video.title ?? "",
    };
  } catch {
    return null;
  }
}

/** `LIVE` en cours ; `LIVE_STOPPED`, `VOD`, `PROCESSING` sont terminés. */
export function isOnAir(status: string): boolean {
  return status === "LIVE" || status === "LIVE_NOW";
}
