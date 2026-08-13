/**
 * ═══════════════════════════════════════════════════════════════════════
 * Relais de la liste de lecture HLS d'un direct Facebook
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Fonction Edge Netlify, exécutée par Deno. Elle ne fait pas partie de
 * l'application Next : elle est déployée séparément sur Netlify, et
 * `NEXT_PUBLIC_HLS_RELAY` la désigne côté client.
 *
 * Pourquoi un relais
 * ──────────────────
 * Facebook sert le HLS d'un direct sur `/video/playback/playlist.m3u8?v=<id>`,
 * mais uniquement aux clients iOS : un agent Android ou de bureau reçoit un
 * HTTP 400. Un navigateur ne peut donc pas la demander lui-même, sauf sur
 * iPhone. En passant par un serveur qui annonce un agent iOS, tous les
 * appareils y ont accès.
 *
 * Pourquoi ailleurs que chez l'hébergeur de l'application
 * ───────────────────────────────────────────────────────
 * La même route déployée sur Vercel renvoie systématiquement une réponse
 * inutilisable, alors qu'une machine de développement obtient la liste dans la
 * même minute, agent iOS explicite compris. L'origine de la requête semble donc
 * filtrée. Que Netlify y échappe reste **à vérifier** : ses fonctions Edge
 * tournent sur Deno Deploy, dont les adresses sont elles aussi des adresses de
 * centre de données. Le premier appel réel tranchera.
 *
 * Ce que ce relais ne transporte pas
 * ──────────────────────────────────
 * Seule la liste maîtresse, quelques kilo-octets de texte. Les variantes
 * qu'elle cite pointent directement sur le CDN de Facebook et sont ouvertes à
 * tous les agents — vérifié sur iPhone, Android, bureau et sans agent. La vidéo
 * ne passe jamais par ici.
 *
 * Limite à connaître
 * ──────────────────
 * Le point d'accès ne sert que les directs **en cours**. Dès qu'un direct est
 * terminé, Facebook renvoie une page HTML : on répond alors 404, et l'interface
 * repasse au greffon. Ce n'est pas une panne, c'est le cycle de vie normal.
 */

const FACEBOOK_PLAYLIST = "https://www.facebook.com/video/playback/playlist.m3u8";

/*
  L'agent est l'élément décisif : c'est lui qui décide si Facebook sert la liste
  ou renvoie un 400. Mesuré — agent iPhone : 200 avec six qualités ; agent
  Android ou de bureau : 400.
*/
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/*
  Ouvert à toutes les origines, et c'est sans risque ici : la réponse ne contient
  aucune donnée privée, aucun cookie n'est accepté ni renvoyé, et le contenu
  provient d'une adresse publique de Facebook. Restreindre à un domaine
  obligerait à redéployer ce relais à chaque préversion.
*/
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "range",
  "access-control-expose-headers": "content-length, content-type",
};

export default async function facebookHls(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...CORS, allow: "GET, HEAD, OPTIONS" } });
  }

  const videoId = new URL(request.url).searchParams.get("v");

  /*
    Un identifiant Facebook est une suite de chiffres. Tout refuser d'autre évite
    de transformer ce relais en passe-plat vers une adresse arbitraire — il est
    ouvert à toutes les origines, il ne doit donc rien accepter d'autre.
  */
  if (!videoId || !/^\d{5,25}$/.test(videoId)) {
    return new Response("Identifiant de vidéo invalide", {
      status: 400,
      headers: { ...CORS, "content-type": "text/plain; charset=utf-8" },
    });
  }

  let playlist: string;
  try {
    const upstream = await fetch(`${FACEBOOK_PLAYLIST}?v=${videoId}`, {
      headers: { "user-agent": IPHONE_UA, accept: "application/vnd.apple.mpegurl,*/*" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      return new Response(null, { status: 404, headers: CORS });
    }
    playlist = await upstream.text();
  } catch {
    // Facebook injoignable ou délai dépassé : l'interface repliera sur le greffon.
    return new Response(null, { status: 504, headers: CORS });
  }

  /*
    Direct terminé, identifiant inconnu, point d'accès modifié : Facebook répond
    alors 200 avec une page HTML. La servir donnerait un lecteur en échec
    silencieux ; un 404 déclenche un repli propre sur le greffon.
  */
  if (!playlist.startsWith("#EXTM3U")) {
    return new Response(null, { status: 404, headers: CORS });
  }

  return new Response(playlist, {
    headers: {
      ...CORS,
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      // Un direct change en permanence : rien ne doit être gardé en cache.
      "cache-control": "no-store",
    },
  });
}

/** Chemin servi. Une fonction Edge déclare le sien ; ce n'est pas `/.netlify/functions/…`. */
export const config = { path: "/hls/facebook" };
