"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/dictionaries";
import { endLive, startLive, updatePinnedProduct } from "@/app/actions/lives";
import { createClient } from "@/lib/supabase/client";
import { cx, formatCount, formatPrice, shortName } from "@/lib/format";
import { startBroadcast, MAX_VIEWERS, type BroadcasterHandle } from "@/lib/live/webrtc";
import { Button, Card } from "@/components/ui/primitives";
import { CameraIcon, CloseIcon, MicIcon } from "@/components/ui/icons";
import { LiveVideo } from "./live-video";
import { QuickProduct } from "./quick-product";
import type { LiveSource } from "@/types/database";

interface Props {
  live: {
    id: string;
    title: string;
    status: "scheduled" | "live" | "ended" | "cancelled";
    source: LiveSource;
    facebook_url: string | null;
    hls_url: string | null;
    pinned_product_id: string | null;
    live_percent_off: number | null;
  };
  products: Array<{ id: string; name: string; price: number; stock: number }>;
}

/**
 * Console de diffusion du vendeur.
 *
 * En source `camera`, le navigateur capture la caméra et diffuse en WebRTC
 * vers chaque spectateur. La page doit rester ouverte et l'écran allumé :
 * une Wake Lock est posée tant que le direct est à l'antenne.
 *
 * En source `facebook`, il n'y a rien à capturer — le vendeur diffuse depuis
 * l'application Facebook, et cette console ne pilote plus que l'état du
 * direct, le produit épinglé et la modération.
 */
export function BroadcastConsole({ live: initialLive, products }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [live, setLive] = useState(initialLive);
  const [handle, setHandle] = useState<BroadcasterHandle | null>(null);
  const [viewers, setViewers] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<
    Array<{ id: string; body: string; author: { first_name: string | null; last_name: string | null } | null }>
  >([]);
  const [pending, startTransition] = useTransition();

  const previewRef = useRef<HTMLVideoElement>(null);

  /*
    Capturer l'image du direct.

    La prévisualisation est NOTRE balise vidéo, alimentée par le flux local : même
    origine, canvas autorisé. Le vendeur montre l'article à la caméra, appuie une
    fois, et la photo du produit est prise — sans lâcher ce qu'il tient, sans
    ouvrir l'appareil photo, sans quitter la diffusion.

    Un article filmé est presque toujours en portrait ou en carré ; on garde
    simplement les dimensions natives de la vidéo, le recadrage viendrait ajouter
    des choix que le vendeur n'a pas demandés.

    `null` si la vidéo n'a pas encore de trame — au tout début de la diffusion,
    `videoWidth` vaut zéro et le canvas serait vide.
  */
  const captureFrame = useCallback(async (): Promise<File | null> => {
    const video = previewRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob) return null;

    return new File([blob], `direct-${Date.now()}.webp`, { type: "image/webp" });
  }, []);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const isCamera = live.source === "camera";
  const onAir = live.status === "live";

  /*
    L'adresse à relayer, s'il y en a une. Jamais en source `camera` : là,
    `LiveVideo` ouvrirait une connexion de *spectateur* vers notre propre
    diffusion, alors que la capture locale est déjà à l'écran juste au-dessus.
  */
  const relayUrl =
    live.source === "facebook" ? live.facebook_url : live.source === "hls" ? live.hls_url : null;

  /* ─── Fil de commentaires, pour répondre pendant le direct ─────────── */
  useEffect(() => {
    if (!onAir) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`console:${live.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_comments", filter: `live_id=eq.${live.id}` },
        async ({ new: row }) => {
          const inserted = row as { id: string; body: string; user_id: string };
          const { data: author } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", inserted.user_id)
            .maybeSingle();

          setComments((current) => [...current.slice(-30), { ...inserted, author }]);
        },
      );

    void channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [live.id, onAir]);

  /* ─── Wake Lock : l'écran ne doit pas s'éteindre en plein direct ───── */
  useEffect(() => {
    if (!onAir || !isCamera) return;

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock?.request("screen");
        if (cancelled) {
          await sentinel?.release();
          return;
        }
        wakeLockRef.current = sentinel ?? null;
      } catch {
        // Wake Lock indisponible (Firefox, iOS ancien) : sans conséquence
        // fonctionnelle, l'écran peut simplement s'éteindre.
      }
    }

    void acquire();

    // Le verrou est perdu quand l'onglet passe en arrière-plan : on le
    // reprend au retour.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [onAir, isCamera]);

  /* ─── Arrêt propre si l'onglet se ferme ────────────────────────────── */
  useEffect(() => {
    if (!handle) return;
    const onUnload = () => void handle.stop();
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [handle]);

  async function onGoLive() {
    setError(null);

    if (!isCamera) {
      // Source Facebook ou HLS : rien à capturer, on annonce simplement.
      startTransition(async () => {
        const result = await startLive(live.id);
        if (result.ok) setLive((c) => ({ ...c, status: "live" }));
        else setError(result.error);
      });
      return;
    }

    let broadcaster: BroadcasterHandle;
    try {
      broadcaster = await startBroadcast(live.id);
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? t.live.cameraDeniedBody
          : t.live.cameraDenied,
      );
      return;
    }

    broadcaster.onViewerCountChange(setViewers);
    setHandle(broadcaster);

    if (previewRef.current) {
      previewRef.current.srcObject = broadcaster.stream;
      void previewRef.current.play().catch(() => undefined);
    }

    const result = await startLive(live.id, broadcaster.peerId);
    if (result.ok) {
      setLive((c) => ({ ...c, status: "live" }));
    } else {
      await broadcaster.stop();
      setHandle(null);
      setError(result.error);
    }
  }

  function onStop() {
    startTransition(async () => {
      await handle?.stop();
      setHandle(null);

      const result = await endLive(live.id);
      if (result.ok) {
        setLive((c) => ({ ...c, status: "ended" }));
        router.push("/vendeur/lives");
      } else {
        setError(result.error);
      }
    });
  }

  function onPin(productId: string) {
    const next = productId === live.pinned_product_id ? null : productId;
    setLive((c) => ({ ...c, pinned_product_id: next }));
    startTransition(async () => {
      await updatePinnedProduct(live.id, next);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {/* ─── Cadre de prévisualisation ─────────────────────────────────── */}
      <div className="relative aspect-[9/13] w-full overflow-hidden rounded-[18px] bg-[#221c2b]">
        {isCamera ? (
          <video
            ref={previewRef}
            playsInline
            autoPlay
            muted
            className="h-full w-full object-cover"
            aria-label={t.live.sourceCamera}
          />
        ) : relayUrl ? (
          /*
            Le relais tel que le voit un client.

            Cette console montrait un texte d'explication à la place de la
            vidéo : le vendeur ne pouvait donc pas savoir si son relais
            fonctionnait, et l'apprenait de ses clients — ou pas du tout. Un
            lien invalide donnait un cadre noir en pleine vente, sans le
            moindre signe ici.

            Le même composant que côté spectateur, délibérément : si l'aperçu
            est bon, ce que voient les clients l'est aussi.
          */
          <LiveVideo
            liveId={live.id}
            source={live.source}
            facebookUrl={live.facebook_url}
            hlsUrl={live.hls_url}
            isLive={onAir}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-[13px] font-bold text-white">
              {live.source === "facebook" ? t.live.sourceFacebook : t.live.sourceHls}
            </p>
            <p className="text-[11px] leading-relaxed text-white/65">
              {live.source === "facebook"
                ? "Lancez le direct depuis l'application Facebook. Les spectateurs le verront ici avec vos produits épinglés."
                : "Le flux externe est diffusé par votre prestataire."}
            </p>
          </div>
        )}

        {onAir && (
          <>
            {/* Décoratifs : ils ne doivent pas capter une touche destinée au
                lecteur relayé, qui exige un geste pour démarrer.

                En source Facebook, le lecteur affiche déjà son propre
                « EN DIRECT » au même endroit : garder le nôtre superposait deux
                étiquettes illisibles. Même choix que sur l'écran spectateur. */}
            {live.source !== "facebook" && (
              <span className="pointer-events-none absolute start-3 top-3 rounded-[4px] bg-[var(--color-live)] px-[9px] py-1 text-[10px] font-bold tracking-[0.5px] text-white">
                {t.live.onAir}
              </span>
            )}
            <span className="pointer-events-none absolute end-3 top-3 rounded-[12px] bg-black/50 px-[9px] py-1 text-[10px] text-white">
              {formatCount(viewers)}
              {isCamera && ` / ${MAX_VIEWERS}`}
            </span>
          </>
        )}

        {onAir && isCamera && handle && (
          <div className="absolute bottom-3 start-1/2 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
            <button
              type="button"
              onClick={() => void handle.switchCamera()}
              aria-label={t.live.switchCamera}
              className="rounded-full bg-black/55 p-3 text-white"
            >
              <CameraIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !micOn;
                setMicOn(next);
                handle.setMicEnabled(next);
              }}
              aria-label={micOn ? t.live.muteMic : t.live.unmuteMic}
              aria-pressed={!micOn}
              className={cx(
                "rounded-full p-3 text-white",
                micOn ? "bg-black/55" : "bg-[var(--color-live)]",
              )}
            >
              <MicIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {isCamera && (
        <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
          {format(
            "Diffusion directe depuis votre appareil, jusqu'à {n} spectateurs simultanés. Au-delà, préférez un direct Facebook.",
            { n: MAX_VIEWERS },
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      {onAir ? (
        <Button tone="danger" block onClick={onStop} disabled={pending}>
          <CloseIcon size={14} />
          <span className="ms-2">{t.live.stopBroadcast}</span>
        </Button>
      ) : (
        <Button block onClick={onGoLive} disabled={pending || live.status === "ended"}>
          {t.live.startBroadcast}
        </Button>
      )}

      {/*
        Ajouter un article sans quitter la diffusion : le vendeur tient la pièce
        en main, l'ouverture du formulaire produit complet lui coûterait son
        direct. Placé au-dessus du produit épinglé, puisque c'est ce qu'il
        épingle juste après.
      */}
      <QuickProduct liveId={live.id} captureFrame={isCamera ? captureFrame : undefined} />

      {/* ─── Produit épinglé ───────────────────────────────────────────── */}
      <Card className="flex flex-col gap-2 p-3">
        <p className="text-[11px] font-bold text-[var(--color-ink)]">{t.live.pinnedProduct}</p>
        <div className="no-sb flex max-h-[180px] flex-col gap-1 overflow-y-auto">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onPin(product.id)}
              className={cx(
                "flex items-center gap-2 rounded-[12px] px-2 py-2 text-start",
                live.pinned_product_id === product.id
                  ? "bg-[var(--color-brand)] text-white"
                  : "hover:bg-[var(--color-brand-tint)]",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{product.name}</span>
              <span className="flex-none text-[11px] font-bold">
                {formatPrice(product.price, locale)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* ─── Commentaires en direct ────────────────────────────────────── */}
      {onAir && (
        <Card className="flex flex-col gap-2 p-3">
          <p className="text-[11px] font-bold text-[var(--color-ink)]">{t.live.comments}</p>
          <div className="no-sb flex max-h-[160px] flex-col gap-1 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-[10.5px] text-[var(--color-muted)]">{t.common.empty}</p>
            ) : (
              comments.map((comment) => (
                <p key={comment.id} className="text-[11px] text-[var(--color-ink)]">
                  <b>{shortName(comment.author) || "…"}:</b> {comment.body}
                </p>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
