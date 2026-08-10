"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { joinBroadcast, type ViewerState } from "@/lib/live/webrtc";
import type { LiveSource } from "@/types/database";

/**
 * Lecteur du direct, polymorphe selon la source enregistrée en base.
 *
 *   camera   — flux WebRTC reçu du téléphone du vendeur
 *   facebook — plugin vidéo officiel, Facebook sert la vidéo
 *   hls      — flux .m3u8 (lecture native Safari/iOS ; ailleurs, lien direct)
 *
 * Les trois occupent le même cadre plein écran : les surcouches commerce
 * (produit épinglé, compte à rebours, commentaires) ne changent pas.
 */
export function LiveVideo({
  liveId,
  source,
  facebookUrl,
  hlsUrl,
  isLive,
}: {
  liveId: string;
  source: LiveSource;
  facebookUrl: string | null;
  hlsUrl: string | null;
  isLive: boolean;
}) {
  if (source === "facebook" && facebookUrl) {
    return <FacebookRelay url={facebookUrl} />;
  }
  if (source === "hls" && hlsUrl) {
    return <HlsPlayer url={hlsUrl} />;
  }
  return <CameraViewer liveId={liveId} isLive={isLive} />;
}

/* ─── Source caméra ────────────────────────────────────────────────────── */

function CameraViewer({ liveId, isLive }: { liveId: string; isLive: boolean }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ViewerState>(isLive ? "connecting" : "ended");

  useEffect(() => {
    if (!isLive) return;

    const viewer = joinBroadcast(liveId, {
      onStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // La lecture automatique n'est tolérée qu'en muet ; le spectateur
          // rétablit le son d'un geste (bouton plus bas dans l'écran live).
          void videoRef.current.play().catch(() => undefined);
        }
      },
      onState: setState,
    });

    return () => {
      void viewer.stop();
    };
  }, [liveId, isLive]);

  const message: Partial<Record<ViewerState, { title: string; body?: string }>> = {
    connecting: { title: t.live.connecting },
    waiting: { title: t.live.waitingBroadcaster },
    full: {
      title: "Direct complet",
      body: "Le nombre de places en caméra directe est atteint. Réessayez dans un instant.",
    },
    ended: { title: t.live.ended, body: t.live.endedBody },
    error: { title: t.common.error, body: t.common.retry },
  };

  const overlay = state === "playing" ? null : message[state];

  return (
    <div className="absolute inset-0 bg-[#221c2b]">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="h-full w-full object-cover"
        aria-label={t.live.onAir}
      />

      {overlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#221c2b]/90 px-10 text-center">
          <p className="text-[13px] font-bold text-white">{overlay.title}</p>
          {overlay.body && (
            <p className="text-[11px] leading-relaxed text-white/65">{overlay.body}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Source Facebook ──────────────────────────────────────────────────── */

/**
 * Relais d'un direct Facebook via le plugin vidéo officiel.
 * L'URL a déjà été validée à l'enregistrement (hôtes Facebook uniquement) ;
 * elle est ré-encodée ici avant d'entrer dans l'iframe.
 */
function FacebookRelay({ url }: { url: string }) {
  const { t } = useI18n();
  const [width, setWidth] = useState(400);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const embed = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&width=${width}`;

  return (
    <div ref={boxRef} className="absolute inset-0 bg-black">
      <iframe
        src={embed}
        title={t.live.facebookRelay}
        className="h-full w-full border-0"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-[10px] bg-black/55 px-3 py-1 text-[9.5px] font-semibold text-white rtl:translate-x-1/2"
      >
        {t.live.openOnFacebook}
      </a>
    </div>
  );
}

/* ─── Source HLS ───────────────────────────────────────────────────────── */

function HlsPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari, iOS et la plupart des navigateurs Android lisent HLS
    // nativement. Ailleurs, plutôt qu'embarquer hls.js pour une source
    // rarement utilisée, on propose le flux en lien direct.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      void video.play().catch(() => undefined);
    } else {
      setSupported(false);
    }
  }, [url]);

  return (
    <div className="absolute inset-0 bg-black">
      <video ref={videoRef} playsInline autoPlay muted controls className="h-full w-full object-contain" />
      {!supported && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#221c2b]/90 px-10 text-center">
          <p className="text-[13px] font-bold text-white">Lecture non prise en charge</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[12px] bg-white/15 px-3 py-2 text-[11px] font-semibold text-white"
          >
            Ouvrir le flux
          </a>
        </div>
      )}
    </div>
  );
}
