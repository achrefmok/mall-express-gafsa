"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [needsTap, setNeedsTap] = useState(false);

  /*
    Démarrer la lecture, et savoir si le navigateur a refusé.

    `play()` renvoie une promesse qui peut être rejetée : le flux est là, la
    connexion est bonne, mais la politique de lecture automatique de l'appareil
    s'y oppose. L'ancien code avalait ce refus (`catch(() => undefined)`), ce qui
    donnait le pire des résultats — un rectangle noir, aucun message, aucun
    moyen d'agir. Les navigateurs mobiles refusent bien plus volontiers que ceux
    de bureau : c'est exactement la panne « ça marche sur PC, noir sur le
    téléphone ».

    En cas de refus, on propose donc au spectateur de toucher l'écran. Un geste
    lève la restriction sur tous les navigateurs.
  */
  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsTap(false);
    } catch {
      setNeedsTap(true);
    }
  }, []);

  useEffect(() => {
    if (!isLive) return;

    const viewer = joinBroadcast(liveId, {
      onStream: (stream) => {
        const video = videoRef.current;
        if (!video) return;
        // La lecture automatique n'est tolérée qu'en muet ; le spectateur
        // rétablit le son d'un geste (bouton plus bas dans l'écran live).
        video.srcObject = stream;
        void tryPlay();
      },
      onState: setState,
    });

    return () => {
      void viewer.stop();
    };
  }, [liveId, isLive, tryPlay]);

  const message: Partial<Record<ViewerState, { title: string; body?: string }>> = {
    connecting: { title: t.live.connecting },
    waiting: { title: t.live.waitingBroadcaster },
    full: {
      title: "Direct complet",
      body: "Le nombre de places en caméra directe est atteint. Réessayez dans un instant.",
    },
    ended: { title: t.live.ended, body: t.live.endedBody },
    error: {
      title: "Connexion au direct impossible",
      body: "Votre réseau bloque la liaison vidéo directe. Essayez en Wi-Fi, ou depuis un autre réseau.",
    },
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

      {/* Le flux est reçu mais l'appareil refuse de le lancer seul. */}
      {!overlay && needsTap && (
        <button
          type="button"
          onClick={() => void tryPlay()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[22px] text-[var(--color-brand)]">
            ▶
          </span>
          <span className="text-[12px] font-bold text-white">{t.live.tapToPlay}</span>
        </button>
      )}
    </div>
  );
}

/* ─── Source Facebook ──────────────────────────────────────────────────── */

/** Largeur de repli quand la mesure échoue : celle d'un téléphone courant. */
const FALLBACK_WIDTH = 380;

/**
 * Relais d'un direct Facebook via le plugin vidéo officiel.
 * L'URL a déjà été validée à l'enregistrement (hôtes Facebook uniquement) ;
 * elle est ré-encodée ici avant d'entrer dans l'iframe.
 */
function FacebookRelay({ url }: { url: string }) {
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  /*
    La largeur entre dans l'adresse de l'iframe, et changer `src` recharge
    l'iframe : le direct repart alors de zéro, écran noir compris. D'où le
    palier de 32 px plus bas — la largeur bouge pour des raisons qui ne nous
    regardent pas (clavier, barre de défilement, rotation d'un pixel), et sans
    palier le direct se coupait à chacune.

    La mesure est prise deux fois, et ce n'est pas une précaution de trop :
    `ResizeObserver` ne notifie que les *changements*. Si sa première mesure
    valait zéro et que la mise en page ne bougeait plus ensuite, la largeur
    restait à zéro pour toujours — aucune iframe, écran noir définitif. La
    mesure synchrone au montage ferme ce piège.

    Et si les deux échouent, on prend `FALLBACK_WIDTH`. Une largeur approchée
    donne au pire une vidéo mal cadrée ; l'absence de largeur ne donne rien du
    tout, et c'est toujours le mauvais choix face à un client qui regarde.
  */
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;

    const apply = (measured: number) =>
      setWidth((current) => (Math.abs(measured - current) < 32 ? current : measured));

    const initial = Math.round(element.getBoundingClientRect().width);
    apply(initial > 0 ? initial : FALLBACK_WIDTH);

    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry.contentRect.width);
      if (measured > 0) apply(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const embed = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&width=${width}`;

  return (
    <div ref={boxRef} className="absolute inset-0 bg-black">
      {width > 0 && (
        <iframe
          src={embed}
          title={t.live.facebookRelay}
          className="h-full w-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
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
