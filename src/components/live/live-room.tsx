"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/client";
import { bumpLiveViewers, pollLive, postLiveComment, toggleLiveLike } from "@/app/actions/lives";
import { placeOrder } from "@/app/actions/cart";
import { countdown, cx, formatCount, formatPrice, shortName } from "@/lib/format";
import { LiveVideo } from "./live-video";
import { LiveProducts, type LiveProduct } from "./live-products";
import { ChatIcon, CloseIcon, HeartIcon, ShareIcon } from "@/components/ui/icons";
import { Placeholder } from "@/components/ui/primitives";
import type { LiveSource } from "@/types/database";

export interface LiveRoomProps {
  live: {
    id: string;
    title: string;
    status: "scheduled" | "live" | "ended" | "cancelled";
    source: LiveSource;
    facebook_url: string | null;
    hls_url: string | null;
    live_percent_off: number | null;
    offer_ends_at: string | null;
    viewers_count: number;
    likes_count: number;
    purchases_count: number;
    shop: { id: string; name: string; slug: string };
  };
  pinnedProduct: {
    id: string;
    name: string;
    price: number;
    images: string[];
    stock: number;
  } | null;
  liveProducts: LiveProduct[];
  initialCartCount: number;
  initialComments: Array<{
    id: string;
    body: string;
    created_at: string;
    author: { first_name: string | null; last_name: string | null } | null;
  }>;
  viewerId: string | null;
  initiallyLiked: boolean;
  contactPhone: string;
}

type Comment = LiveRoomProps["initialComments"][number];

/**
 * Écran 4 — direct plein écran.
 *
 * Trois flux temps réel se superposent :
 *   · le fil de commentaires   → Postgres Changes sur live_comments
 *   · le compteur de spectateurs → Presence du canal
 *   · l'état du direct et le produit épinglé → Postgres Changes sur lives
 *
 * L'achat se fait sans quitter le flux : `place_order` applique la remise
 * « prix live » côté base, la vidéo n'est jamais démontée.
 */
export function LiveRoom({
  live: initialLive,
  pinnedProduct: initialPinned,
  liveProducts,
  initialCartCount,
  initialComments,
  viewerId,
  initiallyLiked,
  contactPhone,
}: LiveRoomProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [live, setLive] = useState(initialLive);
  const [pinned, setPinned] = useState(initialPinned);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [viewers, setViewers] = useState(initialLive.viewers_count);
  const [liked, setLiked] = useState(initiallyLiked);
  const [likes, setLikes] = useState(initialLive.likes_count);
  const [draft, setDraft] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [, startTransition] = useTransition();

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [immersive, setImmersive] = useState(false);
  const [canImmerse, setCanImmerse] = useState(false);

  /*
    Le plein écran porte sur NOTRE conteneur, pas sur l'iframe.

    Agrandir l'iframe seule sortirait la vidéo de l'écran et emporterait avec
    elle le panier, les produits et le produit épinglé — exactement ce que fait
    le plein écran de Facebook, et exactement ce qu'il ne faut pas. En agrandissant
    la racine du direct, tout ce qui est posé dessus reste à l'écran.

    Le bouton ne s'affiche que là où l'API existe : un iPhone n'autorise le plein
    écran que sur une balise vidéo, jamais sur un élément quelconque. Proposer un
    bouton qui ne ferait rien serait pire que ne rien proposer.
  */
  useEffect(() => {
    setCanImmerse(typeof document !== "undefined" && document.fullscreenEnabled === true);

    const onChange = () => setImmersive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleImmersive() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      // Refus du navigateur : l'écran reste utilisable tel quel.
    }
  }

  /* ─── Compte à rebours de l'offre ──────────────────────────────────── */
  useEffect(() => {
    if (!live.offer_ends_at) {
      setRemaining(null);
      return;
    }

    const target = new Date(live.offer_ends_at).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [live.offer_ends_at]);

  /*
    ─── Sondage : commentaires, état du direct, spectateurs ────────────

    Un canal Realtime par spectateur coûtait une connexion permanente —
    la ressource la plus étroite du palier gratuit Supabase, partagée avec
    le reste de l'application (messages, taxi, commandes vendeur). Cinq
    secondes d'attente pour voir un commentaire arriver ne se remarque
    pas ; cent connexions Realtime ouvertes en même temps, si.
  */
  const depuisRef = useRef(new Date().toISOString());

  useEffect(() => {
    let vivant = true;

    async function sonder() {
      const result = await pollLive(live.id, depuisRef.current);
      if (!vivant || !result.ok) return;

      const { live: updated, comments: nouveaux } = result.data;

      if (updated) {
        setLive((current) => ({ ...current, ...updated }));
        setLikes(updated.likes_count);
        setViewers(updated.viewers_count);

        if (updated.pinned_product_id !== (pinned?.id ?? null)) {
          void refreshPinned(updated.pinned_product_id);
        }
      }

      if (nouveaux.length > 0) {
        depuisRef.current = nouveaux[nouveaux.length - 1]!.created_at;
        setComments((current) => {
          const connus = new Set(current.map((c) => c.id));
          const ajouts = nouveaux.filter((c) => !connus.has(c.id));
          return ajouts.length > 0 ? [...current.slice(-60), ...ajouts].slice(-60) : current;
        });
      }
    }

    async function refreshPinned(productId: string | null) {
      if (!productId) {
        setPinned(null);
        return;
      }
      const { data } = await supabase
        .from("products")
        .select("id, name, price, images, stock")
        .eq("id", productId)
        .maybeSingle();
      if (vivant) setPinned(data);
    }

    void sonder();
    const minuterie = setInterval(sonder, 5_000);
    return () => {
      vivant = false;
      clearInterval(minuterie);
    };
  }, [live.id, pinned?.id, supabase]);

  /* ─── Présence, en entrée et en sortie plutôt qu'en continu ─────────── */
  useEffect(() => {
    if (!viewerId) return;

    void bumpLiveViewers(live.id, 1);
    return () => void bumpLiveViewers(live.id, -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- un direct ne change pas d'identifiant en cours de montage
  }, [viewerId]);

  /* ─── Fil de commentaires : garder le dernier visible ──────────────── */
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [comments.length]);

  /* ─── Actions ──────────────────────────────────────────────────────── */

  const requireAccount = useCallback(() => {
    if (viewerId) return false;
    router.push(`/connexion?suite=/lives/${live.id}`);
    return true;
  }, [viewerId, router, live.id]);

  function onSend(event: React.FormEvent) {
    event.preventDefault();
    if (requireAccount()) return;

    const body = draft.trim();
    if (!body) return;

    setDraft("");
    startTransition(async () => {
      const result = await postLiveComment(live.id, body);
      if (!result.ok) {
        setDraft(body);
        setToast({ kind: "error", message: result.error });
      }
    });
  }

  function onLike() {
    if (requireAccount()) return;

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes((n) => n + (wasLiked ? -1 : 1));

    startTransition(async () => {
      const result = await toggleLiveLike(live.id, wasLiked);
      if (!result.ok) {
        setLiked(wasLiked);
        setLikes((n) => n + (wasLiked ? 1 : -1));
      }
    });
  }

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: live.title, url });
      } catch {
        /* annulé */
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
    setToast({ kind: "ok", message: t.common.share });
  }

  /** Achat en un geste, sans quitter le direct. */
  function onBuy() {
    if (!pinned || requireAccount()) return;

    setBuying(true);
    setToast(null);

    startTransition(async () => {
      const result = await placeOrder({
        shopId: live.shop.id,
        items: [{ product_id: pinned.id, quantity: 1 }],
        paymentMethod: "cod",
        deliveryMethod: "pickup",
        contactPhone,
        liveId: live.id,
      });

      setBuying(false);

      if (result.ok) {
        setToast({ kind: "ok", message: t.cart.placed });
        setLive((current) => ({ ...current, purchases_count: current.purchases_count + 1 }));
      } else {
        setToast({ kind: "error", message: result.error });
      }
    });
  }

  const livePrice =
    pinned && live.live_percent_off
      ? pinned.price * (1 - live.live_percent_off / 100)
      : (pinned?.price ?? 0);

  const offerActive = live.live_percent_off !== null && (remaining === null || remaining > 0);
  const progress = live.offer_ends_at && remaining !== null ? computeProgress(remaining) : null;

  return (
    <div
      ref={rootRef}
      className="relative mx-auto h-dvh max-w-[520px] overflow-hidden bg-[#221c2b] text-white"
    >
      <LiveVideo
        liveId={live.id}
        source={live.source}
        facebookUrl={live.facebook_url}
        hlsUrl={live.hls_url}
        isLive={live.status === "live"}
      />

      {/*
        ─── Bandeau haut ──────────────────────────────────────────────────

        `pointer-events-none` sur le conteneur, rétabli sur le seul élément
        cliquable qu'il porte.

        Ce bandeau couvre toute la largeur en `z-20`, juste au-dessus du
        lecteur. Or le greffon Facebook aligne sa vidéo en haut de l'iframe et
        la dimensionne sur la largeur : sur un téléphone, une vidéo paysage
        n'occupe que le haut de l'écran, et son bouton de lecture tombe sous
        ce bandeau — que l'encart de sécurité d'un iPhone à encoche descend
        encore plus bas. Facebook interdisant l'autoplay dans son greffon
        (`autoplay=()` dans ses propres en-têtes), cette touche est le seul
        moyen de lancer la vidéo : captée par un badge décoratif, elle laissait
        un écran noir définitif là où un ordinateur, sans encart, s'en sortait.
      */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-[14px]">
        <div className="flex items-center gap-2">
          {live.status === "live" ? (
            /*
              En source Facebook, le lecteur dessine déjà son propre « EN DIRECT »
              au même endroit : les deux se chevauchaient et devenaient illisibles.
              On efface le nôtre, qui n'apprend rien de plus une fois le direct à
              l'antenne. Le compteur de spectateurs reste : c'est le nôtre, il
              compte l'audience de la boutique et non celle de Facebook.

              Hors antenne — programmé, terminé — notre badge est le seul à
              porter l'information, puisque le lecteur n'affiche alors rien.
            */
            live.source !== "facebook" && (
              <span className="rounded-[4px] bg-[var(--color-live-fill)] px-[9px] py-1 text-[0.625rem] font-bold tracking-[0.03125rem]">
                {t.live.onAir}
              </span>
            )
          ) : (
            <span className="rounded-[4px] bg-white/20 px-[9px] py-1 text-[0.625rem] font-bold">
              {live.status === "scheduled" ? t.live.scheduled : t.live.ended}
            </span>
          )}
          <span className="rounded-[12px] bg-black/50 px-[9px] py-1 text-[0.625rem]">
            {format(t.live.viewers, { n: formatCount(Math.max(viewers, live.viewers_count)) })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canImmerse && (
            <button
              type="button"
              onClick={() => void toggleImmersive()}
              aria-label={immersive ? t.live.exitImmersive : t.live.immersive}
              aria-pressed={immersive}
              className="pointer-events-auto rounded-full bg-black/40 px-3 py-2 text-[0.6875rem] font-semibold"
            >
              {immersive ? "⤡" : "⤢"}
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push("/lives")}
            aria-label={t.common.close}
            className="pointer-events-auto rounded-full bg-black/40 p-2"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      {/* ─── Barre d'urgence : compte à rebours + progression ──────────── */}
      {offerActive && (
        <div className="absolute bottom-[192px] start-[14px] end-[70px] z-20 flex items-center gap-[9px] rounded-[14px] bg-black/50 p-[8px_11px]">
          {remaining !== null && (
            <span className="flex-none rounded-[9px] bg-[var(--color-live-fill)] px-[7px] py-[3px] text-[0.625rem] font-bold tabular-nums">
              {countdown(remaining)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {progress !== null && (
              <div className="h-1 overflow-hidden rounded-[2px] bg-white/25">
                <div className="h-full bg-white transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            )}
            <p className="mt-1 truncate text-[0.59375rem] text-white/85">
              {format(t.live.livePrice, {
                n: live.live_percent_off ?? 0,
                buyers: live.purchases_count,
              })}
            </p>
          </div>
        </div>
      )}

      {/* ─── Produit épinglé ───────────────────────────────────────────── */}
      {pinned && (
        <div className="absolute bottom-[120px] start-[14px] end-[70px] z-20 flex items-center gap-[10px] rounded-[10px] bg-white/95 p-[10px]">
          {pinned.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniature 44px, hors flux Next/Image pour ne pas retarder la vidéo
            <img
              src={pinned.images[0]}
              alt=""
              className="h-11 w-11 flex-none rounded-[16px] object-cover"
            />
          ) : (
            <Placeholder className="h-11 w-11 flex-none" rounded="tile" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.6875rem] font-semibold text-[var(--color-ink)]">{pinned.name}</p>
            <p className="text-[0.75rem] font-bold text-[var(--color-brand)]">
              {formatPrice(livePrice, locale)}
              {offerActive && live.live_percent_off && (
                <span className="ms-[6px] text-[0.625rem] font-normal text-[var(--color-faint)] line-through">
                  {formatPrice(pinned.price, locale)}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onBuy}
            disabled={buying || pinned.stock <= 0 || live.status !== "live"}
            className="flex-none rounded-[14px] bg-[var(--color-brand-fill)] px-3 py-[7px] text-[0.625rem] font-semibold text-white disabled:opacity-55"
          >
            {pinned.stock <= 0 ? t.product.outOfStock : buying ? "…" : t.live.buy}
          </button>
        </div>
      )}

      {/* ─── La boutique du direct ─────────────────────────────────────── */}
      <LiveProducts
        liveId={live.id}
        initialProducts={liveProducts}
        percentOff={offerActive ? live.live_percent_off : null}
        canBuy={live.status === "live"}
        initialCartCount={initialCartCount}
      />

      {/* ─── Colonne d'actions ─────────────────────────────────────────── */}
      <div className="absolute bottom-[34px] end-[14px] z-20 flex w-[52px] flex-col items-center gap-[14px]">
        <button type="button" onClick={onLike} className="flex flex-col items-center" aria-pressed={liked}>
          <HeartIcon size={22} filled={liked} className={liked ? "text-[var(--color-live)]" : ""} />
          <span className="text-[0.5625rem]">{formatCount(likes)}</span>
        </button>

        <div className="flex flex-col items-center" aria-hidden>
          <ChatIcon size={21} />
          <span className="text-[0.5625rem]">{formatCount(comments.length)}</span>
        </div>

        <button type="button" onClick={onShare} className="flex flex-col items-center">
          <ShareIcon size={21} />
          <span className="text-[0.5625rem]">{t.common.share}</span>
        </button>
      </div>

      {/* ─── Fil de commentaires + saisie ──────────────────────────────── */}
      <div className="pb-safe absolute bottom-0 start-0 end-[70px] z-20 flex flex-col gap-[6px] p-[14px]">
        <div className="no-sb flex max-h-[120px] flex-col gap-[6px] overflow-y-auto">
          {comments.slice(-12).map((comment) => (
            <p
              key={comment.id}
              className="w-fit max-w-full rounded-[10px] bg-black/35 px-[9px] py-1 text-[0.6875rem]"
            >
              <b>{shortName(comment.author) || "…"}:</b> {comment.body}
            </p>
          ))}
          <div ref={commentsEndRef} />
        </div>

        {live.status === "live" && (
          <form onSubmit={onSend} className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder={t.live.writeComment}
              aria-label={t.live.writeComment}
              className="min-w-0 flex-1 rounded-[14px] bg-black/45 px-3 py-2 text-[0.6875rem] text-white outline-none placeholder:text-white/55 focus:bg-black/60"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex-none rounded-[14px] bg-[var(--color-brand-fill)] px-3 py-2 text-[0.625rem] font-bold disabled:opacity-40"
            >
              {t.live.send}
            </button>
          </form>
        )}
      </div>

      {toast && (
        <div
          role="status"
          onAnimationEnd={() => setTimeout(() => setToast(null), 2400)}
          className={cx(
            "animate-slide-up absolute bottom-[240px] start-1/2 z-30 -translate-x-1/2 rounded-[14px] px-4 py-2 text-[0.71875rem] font-bold rtl:translate-x-1/2",
            toast.kind === "ok" ? "bg-[var(--color-brand-fill)] text-white" : "bg-[var(--color-live-fill)] text-white",
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/**
 * Progression de l'offre. Sans durée totale connue côté client, on borne à
 * 10 minutes : la barre reste lisible et ne saute pas.
 */
function computeProgress(remainingMs: number): number {
  const window = 10 * 60 * 1000;
  return Math.max(0, Math.min(100, Math.round((remainingMs / window) * 100)));
}
