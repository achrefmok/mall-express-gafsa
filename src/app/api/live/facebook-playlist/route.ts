import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liste de lecture HLS d'un direct Facebook, relayée par nous.
 *
 * Pourquoi ce relais existe
 * ─────────────────────────
 * Facebook sert le HLS d'un direct sur `/video/playback/playlist.m3u8?v=<id>`,
 * mais uniquement aux clients iOS : mesuré, un agent Android ou de bureau reçoit
 * un HTTP 400. Un navigateur ne peut donc pas la demander lui-même. Notre
 * serveur, lui, l'obtient sans difficulté — l'endpoint répond 200 à une requête
 * sans agent.
 *
 * Seule cette liste maîtresse passe par nous. Les variantes qu'elle cite sont
 * ouvertes à tous les agents — vérifié sur iPhone, Android, bureau et sans agent
 * — et pointent directement sur le CDN de Facebook : la vidéo ne transite pas
 * par notre serveur, seuls quelques kilo-octets de texte.
 *
 * À quoi cela sert
 * ────────────────
 * Le greffon vidéo de Facebook ne démarre jamais seul — il renvoie
 * `Permissions-Policy: autoplay=()` — et sur iOS il refuse même de lire en
 * ligne, imposant un plein écran qui recouvre toute la couche commerce. Servi
 * dans une balise `video` en sourdine, ce flux démarre sans aucun geste.
 *
 * Réserves
 * ────────
 * Ce point d'accès n'est pas documenté par Facebook. Il n'est ni signé ni
 * horodaté — il ne demande que l'identifiant public de la vidéo, ce qui le rend
 * bien plus stable que les adresses signées du CDN — mais il peut être
 * restreint sans préavis. Un échec ici renvoie 404, et l'interface repasse
 * alors au greffon.
 *
 * Il ne sert que les directs en cours : une vidéo terminée renvoie une réponse
 * qui n'est pas une liste de lecture, d'où la vérification ci-dessous.
 */
export async function GET(request: Request) {
  const videoId = new URL(request.url).searchParams.get("v");

  // Un identifiant Facebook est une suite de chiffres. Refuser tout le reste
  // évite de transformer cette route en relais vers une adresse arbitraire.
  if (!videoId || !/^\d{5,25}$/.test(videoId)) {
    return NextResponse.json({ erreur: "Identifiant de vidéo invalide" }, { status: 400 });
  }

  let playlist: string;
  try {
    const upstream = await fetch(
      `https://www.facebook.com/video/playback/playlist.m3u8?v=${videoId}`,
      {
        cache: "no-store",
        /*
          L'agent est fixé, et il compte : Facebook ne sert cette liste qu'aux
          clients iOS. Mesuré, un agent Android ou de bureau reçoit un HTTP 400.
          Ne rien envoyer marchait depuis un poste de développement, mais rien ne
          garantit ce que l'hébergeur ajoute à une requête sortante — et un agent
          inattendu suffirait à faire retomber tous les spectateurs sur le
          greffon, sans que rien ne le signale.
        */
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          accept: "application/vnd.apple.mpegurl,*/*",
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!upstream.ok) return new NextResponse(null, { status: 404 });
    playlist = await upstream.text();
  } catch {
    // Facebook injoignable ou délai dépassé : l'interface repliera sur le greffon.
    return new NextResponse(null, { status: 504 });
  }

  // Direct terminé, identifiant inconnu, endpoint modifié : la réponse n'est
  // alors pas une liste de lecture, et la servir donnerait un lecteur en erreur
  // silencieuse plutôt qu'un repli propre.
  if (!playlist.startsWith("#EXTM3U")) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(playlist, {
    headers: {
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      // Un direct change en permanence : rien ne doit être gardé.
      "cache-control": "no-store",
    },
  });
}
