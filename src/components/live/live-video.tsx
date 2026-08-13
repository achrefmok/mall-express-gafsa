"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { joinBroadcast, type ViewerState } from "@/lib/live/webrtc";
import { facebookHlsUrl } from "@/lib/live/facebook";
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

/** Dimensions de repli quand la mesure échoue : celles d'un téléphone courant. */
const FALLBACK_WIDTH = 380;
const FALLBACK_HEIGHT = 675;

/**
 * Ce navigateur lit-il le HLS nativement ?
 *
 * On interroge la capacité plutôt que l'identité : `canPlayType` répond pour ce
 * navigateur-ci, là où renifler l'agent revient à tenir une liste d'appareils
 * qui vieillit mal. Safari et iOS répondent oui, la plupart des navigateurs
 * Android aussi, Chrome de bureau non — et là le greffon de Facebook fonctionne
 * très bien, on le lui laisse.
 *
 * Le navigateur renvoie « probably », « maybe » ou une chaîne vide. On accepte
 * les deux premières : « maybe » est la réponse habituelle de Safari pour le
 * HLS, et la refuser écarterait précisément les appareils que l'on vise.
 */
function playsHlsNatively(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("video");
  return probe.canPlayType("application/vnd.apple.mpegurl") !== "";
}

/**
 * iPhone ou iPad ?
 *
 * Sert uniquement à rédiger la consigne quand on retombe sur le greffon : là-bas
 * le lecteur de Facebook refuse de lire en ligne et impose le plein écran, alors
 * qu'ailleurs un simple appui suffit. Ce n'est pas une capacité qu'on peut
 * interroger — c'est un comportement de plateforme —, d'où le recours à l'agent,
 * qui reste le moindre mal pour ne pas donner une consigne fausse.
 *
 * iPadOS 13 et suivants se présentent comme un Mac : d'où le second test, sur un
 * Mac tactile, qui n'existe pas.
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Relais d'un direct Facebook via le plugin vidéo officiel.
 * L'URL a déjà été validée à l'enregistrement (hôtes Facebook uniquement) ;
 * elle est ré-encodée ici avant d'entrer dans l'iframe.
 */
function FacebookRelay({ url }: { url: string }) {
  const { t } = useI18n();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  /*
    Les deux dimensions entrent dans l'adresse de l'iframe.

    La hauteur y était absente, et c'était une erreur : sans elle le greffon
    dimensionne la vidéo sur la seule largeur et la colle en haut du cadre. Sur
    un téléphone en portrait, une vidéo paysage n'occupait donc qu'un bandeau
    supérieur, le reste en noir — et son bouton de lecture, minuscule, se perdait
    au milieu de ce bandeau. Avec les deux dimensions, le greffon ajuste la vidéo
    dans le cadre entier et centre ses contrôles.

    Changer `src` recharge l'iframe et le direct repart de zéro. D'où le palier
    de 32 px : la largeur bouge pour des raisons qui ne nous regardent pas, et
    sans palier le direct se coupait à chacune.

    La hauteur, elle, ne déclenche jamais de rechargement à elle seule — elle est
    relevée en même temps que la largeur. Sur mobile la hauteur `dvh` varie quand
    la barre d'adresse se replie : la lier au rechargement couperait le direct au
    premier défilement. Une rotation, elle, change la largeur, donc les deux sont
    bien reprises quand cela compte.

    La mesure est prise deux fois, et ce n'est pas une précaution de trop :
    `ResizeObserver` ne notifie que les *changements*. Si sa première mesure
    valait zéro et que la mise en page ne bougeait plus ensuite, elle restait à
    zéro pour toujours — aucune iframe, écran noir définitif.

    Et si les deux échouent, on prend les valeurs de repli. Un cadre approché
    donne au pire une vidéo mal ajustée ; l'absence de mesure ne donne rien du
    tout, et c'est toujours le mauvais choix face à un client qui regarde.
  */
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;

    const apply = (width: number, height: number) =>
      setBox((current) =>
        Math.abs(width - current.width) < 32 ? current : { width, height },
      );

    const rect = element.getBoundingClientRect();
    apply(
      Math.round(rect.width) || FALLBACK_WIDTH,
      Math.round(rect.height) || FALLBACK_HEIGHT,
    );

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0) apply(width, height || FALLBACK_HEIGHT);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /*
    Facebook interdit la lecture automatique dans son propre greffon — ses
    en-têtes renvoient `autoplay=()`, mesuré identique sur iPhone, Android et
    ordinateur. Le paramètre `autoplay=true` ci-dessous ne change donc rien : la
    vidéo ne démarre que sur un geste du spectateur.

    Or rien ne l'indiquait, et le bouton du greffon est petit et posé en bas à
    gauche — juste à côté de notre champ de commentaire. Le spectateur tâtonnait,
    et finissait par toucher « Agrandir ». Un appui au centre de la vidéo lance
    aussi la lecture : c'est donc là qu'on l'invite à appuyer, avec une cible
    large qu'on ne peut pas manquer.

    `pointer-events-none` est ici indispensable : le geste doit atteindre le
    lecteur, à l'intérieur de l'iframe. Un calque qui l'intercepterait
    empêcherait définitivement la lecture — c'est exactement ce que faisait le
    bandeau de l'écran spectateur.

    Nous ne pouvons pas lire l'état du lecteur : l'iframe est d'une autre
    origine. Mais nous savons quand le spectateur y a touché — un appui dans une
    iframe donne le focus à l'élément côté parent. L'indication s'effave donc sur
    ce signal, et un délai de repli couvre les navigateurs qui ne l'émettent pas.
  */
  const [showHint, setShowHint] = useState(true);
  const [hlsCapable, setHlsCapable] = useState(false);
  const [onIOS, setOnIOS] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const focusedByUs = useRef(false);

  const giveUpNative = useCallback(() => setNativeFailed(true), []);

  // Après hydratation seulement : le serveur ne connaît pas les capacités du
  // navigateur, et rendre deux arbres différents de part et d'autre casserait
  // l'hydratation.
  useEffect(() => {
    setHlsCapable(playsHlsNatively());
    setOnIOS(isIOS());
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const hide = () => {
      // Ignorer le focus que nous posons nous-mêmes juste en dessous.
      if (!focusedByUs.current) setShowHint(false);
    };

    frame?.addEventListener("focus", hide);
    const timer = setTimeout(hide, 20_000);

    return () => {
      frame?.removeEventListener("focus", hide);
      clearTimeout(timer);
    };
  }, [box.width]);

  /*
    Donner le focus à l'iframe dès qu'elle est chargée.

    Safari sur iOS demande un premier appui pour donner le focus à une iframe
    d'une autre origine ; seul le second actionne le contrôle visé. D'où le
    « il faut agrandir, puis démarrer » — deux gestes là où un seul devrait
    suffire. En posant ce focus nous-mêmes, le premier appui du spectateur
    tombe directement sur le bouton de lecture.

    `preventScroll` est indispensable : sans lui, donner le focus fait défiler
    la page jusqu'à l'élément, ce qui déplacerait l'écran du direct.

    Réserve honnête : ce comportement d'iOS n'est pas documenté noir sur blanc
    et je n'ai pas pu le reproduire depuis un terminal. La manœuvre est sans
    risque — au pire elle ne change rien.
  */
  const focusFrame = () => {
    const frame = frameRef.current;
    if (!frame) return;

    focusedByUs.current = true;
    frame.focus({ preventScroll: true });
    setTimeout(() => {
      focusedByUs.current = false;
    }, 0);
  };

  const embed = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&width=${box.width}&height=${box.height}`;

  /*
    Notre propre lecteur dès que le navigateur sait lire du HLS.

    Le greffon de Facebook ne démarre jamais seul — il renvoie
    `Permissions-Policy: autoplay=()` — et sur iOS il refuse même de lire en
    ligne, imposant un plein écran qui recouvre toute la couche commerce au
    moment précis où le commerçant vend. Le même direct servi en HLS dans une
    balise `video` en sourdine démarre, lui, sans aucun geste.

    Réservé à iOS, et pas par préférence : Facebook ne sert cette liste de
    lecture qu'aux clients iOS, l'appareil devant la demander lui-même. Relayer
    la requête par notre serveur pour en faire profiter Android a été tenté et
    échoue — Facebook refuse les serveurs de l'hébergeur, agent iOS explicite
    compris. C'est l'adresse d'origine qui est filtrée.

    Ailleurs — Android, ordinateur — le greffon reste utilisé : il y fonctionne,
    compte les vues du commerçant et porte l'attribution Facebook.

    `nativeFailed` ramène à l'iframe dès que la lecture échoue : direct terminé,
    point d'accès modifié, réseau. Mieux vaut le greffon qu'un écran noir.
  */
  const hls = facebookHlsUrl(url);
  const useNativePlayer = onIOS && hlsCapable && hls !== null && !nativeFailed;

  return (
    <div ref={boxRef} className="absolute inset-0 bg-black">
      {useNativePlayer ? (
        <FacebookHlsVideo src={hls} onFail={giveUpNative} label={t.live.facebookRelay} />
      ) : (
        box.width > 0 && (
          <iframe
            ref={frameRef}
            src={embed}
            title={t.live.facebookRelay}
            className="h-full w-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={focusFrame}
          />
        )
      )}

      {/*
        Le libellé seul, sous le centre.

        Nous dessinions ici un disque de lecture, qui se posait pile sur celui
        du greffon — déjà centré — et le masquait. Le spectateur croyait toucher
        notre bouton, et nous cachions le vrai. On garde donc uniquement la
        phrase, décalée sous le centre pour laisser le bouton de Facebook visible
        et libre.
      */}
      {/* Sans objet quand notre lecteur prend la main : il démarre tout seul. */}
      {showHint && !useNativePlayer && (
        <div className="pointer-events-none absolute inset-x-0 top-[58%] flex justify-center px-6">
          <span className="rounded-[12px] bg-black/70 px-3 py-[6px] text-center text-[11px] font-semibold text-white">
            {onIOS ? t.live.tapFullscreenToPlay : t.live.tapToPlay}
          </span>
        </div>
      )}

      {/*
        Porte de sortie quand le greffon ne veut rien afficher. Elle était en bas
        au centre, donc masquée par la barre de commentaires de l'écran
        spectateur : inatteignable au moment précis où elle sert. Remontée sous
        le bandeau, et au-dessus des surcouches de l'écran.
      */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute start-1/2 top-[52px] z-30 -translate-x-1/2 rounded-[10px] bg-black/55 px-3 py-1 text-[9.5px] font-semibold text-white rtl:translate-x-1/2"
      >
        {t.live.openOnFacebook}
      </a>
    </div>
  );
}

/**
 * Le direct Facebook, lu par notre balise vidéo depuis son flux HLS.
 *
 * Réservé à iOS, où le greffon refuse de lire en ligne. `muted` est ce qui rend
 * le démarrage sans geste possible : c'est la seule lecture automatique que les
 * navigateurs mobiles tolèrent. `controls` laisse le spectateur rétablir le son
 * d'un geste, comme sur n'importe quelle vidéo.
 *
 * Toute défaillance — format refusé, flux absent parce que le direct est fini,
 * réseau — remonte à l'appelant, qui repasse alors au greffon.
 */
function FacebookHlsVideo({
  src,
  onFail,
  label,
}: {
  src: string;
  onFail: () => void;
  label: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari lit le HLS nativement ; ailleurs il faudrait une bibliothèque, et
    // ailleurs le greffon fonctionne déjà.
    if (!video.canPlayType("application/vnd.apple.mpegurl")) {
      onFail();
      return;
    }

    video.src = src;
    void video.play().catch(() => undefined);
  }, [src, onFail]);

  return (
    <video
      ref={videoRef}
      playsInline
      autoPlay
      muted
      controls
      onError={onFail}
      aria-label={label}
      className="h-full w-full object-contain"
    />
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
