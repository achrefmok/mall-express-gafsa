"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createLive } from "@/app/actions/lives";
import { cx, formatPrice } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Button, Card, Divider, KeyValueRow, Switch, fieldClass } from "@/components/ui/primitives";
import { MAX_VIEWERS } from "@/lib/live/webrtc";
import type { LiveSource } from "@/types/database";

const FIELD =
  fieldClass({});
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

/**
 * Programmation d'un direct. Le choix de la source est le point structurant :
 * il décide de qui transporte la vidéo, et donc du plafond d'audience.
 */
const pad2 = (n: number) => String(n).padStart(2, "0");

function dateLocaleISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Dans N minutes, arrondi à la minute : pour les raccourcis « dans 30 min », etc. */
function dansMinutes(n: number): string {
  return dateLocaleISO(new Date(Date.now() + n * 60_000));
}

/** Dans deux heures : le délai qui laisse le temps de prévenir. */
function dansDeuxHeures(): string {
  const d = new Date(Date.now() + 2 * 3_600_000);
  d.setMinutes(0, 0, 0);
  return dateLocaleISO(d);
}

/** Les raccourcis proposés au-dessus du champ de date. */
const RACCOURCIS_DELAI = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 h" },
  { minutes: 120, label: "2 h" },
] as const;

export function NewLiveForm({
  products,
  shopApproved,
}: {
  products: Array<{ id: string; name: string; price: number; stock: number }>;
  shopApproved: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [source, setSource] = useState<LiveSource>("camera");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [hlsUrl, setHlsUrl] = useState("");
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [percentOff, setPercentOff] = useState("30");
  const [offerMinutes, setOfferMinutes] = useState("10");
  const [programme, setProgramme] = useState(false);
  const [debut, setDebut] = useState(dansDeuxHeures);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sources: Array<{ value: LiveSource; label: string; hint: string }> = [
    {
      value: "camera",
      label: t.live.sourceCamera,
      hint: `Diffusion directe depuis votre téléphone, jusqu'à ${MAX_VIEWERS} spectateurs simultanés.`,
    },
    {
      value: "facebook",
      label: t.live.sourceFacebook,
      hint: "Vous diffusez sur votre page Facebook ; le direct est relayé ici avec vos produits. Audience illimitée.",
    },
    {
      value: "hls",
      label: t.live.sourceHls,
      hint: "Flux fourni par un prestataire externe (Mux, Cloudflare Stream…).",
    },
  ];

  function onCreate() {
    setError(null);

    startTransition(async () => {
      const result = await createLive({
        title,
        titleAr,
        source,
        facebookUrl,
        hlsUrl,
        pinnedProductId: pinnedProductId ?? undefined,
        percentOff: Number.parseInt(percentOff, 10) || undefined,
        offerMinutes: Number.parseInt(offerMinutes, 10) || undefined,
        // Sans date, le direct est créé pour maintenant : c'est le cas courant.
        scheduledAt: programme ? new Date(debut).toISOString() : undefined,
      });

      if (result.ok) router.push(`/vendeur/lives/${result.data.id}`);
      else setError(result.error);
    });
  }

  return (
    <>
      <TopBar title={t.vendor.newLive} back="/vendeur/lives" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        {!shopApproved && (
          <p
            role="status"
            className="rounded-[14px] bg-[var(--color-live-tint)] p-3 text-[0.6875rem] font-semibold text-[var(--color-live)]"
          >
            {t.vendor.pendingBanner} — {t.vendor.pendingBody}
          </p>
        )}

        <Card className="flex flex-col gap-[10px] p-3">
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t.vendor.liveTitle}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>العنوان بالعربية</span>
            <input
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              dir="rtl"
              lang="ar"
              className={FIELD}
            />
          </label>

          {/*
            Programmer, plutôt que de lancer maintenant.

            Un direct annoncé deux heures à l'avance réunit un public ; un
            direct lancé sans prévenir parle à ceux qui passaient par là. Le
            rendez-vous s'affiche alors sur la fiche de la boutique avec son
            compte à rebours, et le commerçant ouvre l'antenne à l'heure dite
            — rien ne démarre tout seul, personne ne veut être filmé par
            surprise.
          */}
          <Divider />

          <KeyValueRow label={<span className={LABEL}>Programmer le direct</span>}>
            <Switch checked={programme} onChange={setProgramme} label="Programmer le direct" />
          </KeyValueRow>

          {programme && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-[6px]">
                {RACCOURCIS_DELAI.map((r) => (
                  <button
                    key={r.minutes}
                    type="button"
                    onClick={() => setDebut(dansMinutes(r.minutes))}
                    className="rounded-full border border-[var(--color-outline)] px-[11px] py-[6px] text-[0.65625rem] font-bold text-[var(--color-brand)]"
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <label className="flex flex-col gap-1">
                <span className={LABEL}>Rendez-vous</span>
                <input
                  type="datetime-local"
                  value={debut}
                  onChange={(e) => setDebut(e.target.value)}
                  className={FIELD}
                />
              </label>
            </div>
          )}
        </Card>

        {/* ─── Source vidéo ──────────────────────────────────────────── */}
        <Card className="flex flex-col gap-2 p-3">
          <span className={LABEL}>{t.vendor.liveSource}</span>

          <div role="radiogroup" aria-label={t.vendor.liveSource} className="flex flex-col gap-2">
            {sources.map((option) => {
              const active = source === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSource(option.value)}
                  className={cx(
                    "flex flex-col gap-1 rounded-[14px] p-[10px] text-start transition-colors",
                    active
                      ? "bg-[var(--color-brand-fill)] text-white"
                      : "border border-[var(--color-outline)]",
                  )}
                >
                  <span className="text-[0.71875rem] font-bold">{option.label}</span>
                  <span
                    className={cx(
                      "text-[0.625rem] leading-[1.4]",
                      active ? "opacity-85" : "text-[var(--color-muted)]",
                    )}
                  >
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {source === "facebook" && (
            <label className="mt-1 flex flex-col gap-1">
              <span className={LABEL}>{t.vendor.facebookUrl}</span>

              <span className="flex gap-2">
                <input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.facebook.com/…/videos/…"
                  className={cx(FIELD, "min-w-0 flex-1")}
                />

                {/*
                  Un geste au lieu d'un appui long suivi d'un « Coller ».
                  Le commerçant vient de toucher « Copier le lien » sur
                  Facebook : le presse-papiers contient déjà ce qu'il faut.

                  `readText` exige un geste de l'utilisateur et n'existe pas
                  partout — d'où le repli silencieux sur la saisie manuelle,
                  le champ restant à côté.
                */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const pasted = await navigator.clipboard?.readText();
                      if (pasted?.trim()) setFacebookUrl(pasted.trim());
                    } catch {
                      // Refusé ou indisponible : le champ reste utilisable.
                    }
                  }}
                  className="flex-none rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-veil)] px-3 text-[0.65625rem] font-bold whitespace-nowrap text-[var(--color-brand)]"
                >
                  Coller le lien
                </button>
              </span>

              <span className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
                {t.vendor.facebookUrlHint}
              </span>

              <span className="mt-1 rounded-[12px] bg-[var(--color-brand-tint)] p-2 text-[0.59375rem] leading-[1.5] text-[var(--color-ink)]">
                <strong>Plus rapide, sur Android :</strong> installez
                l&apos;application, puis touchez « Partager » sur votre vidéo
                Facebook et choisissez G-Mall. Le direct se met en ligne
                sans que vous ayez à copier quoi que ce soit.
              </span>
            </label>
          )}

          {source === "hls" && (
            <label className="mt-1 flex flex-col gap-1">
              <span className={LABEL}>{t.vendor.hlsUrl}</span>
              <input
                value={hlsUrl}
                onChange={(e) => setHlsUrl(e.target.value)}
                type="url"
                inputMode="url"
                placeholder="https://…/index.m3u8"
                className={FIELD}
              />
            </label>
          )}
        </Card>

        {/* ─── Produit épinglé et offre ──────────────────────────────── */}
        <Card className="flex flex-col gap-2 p-3">
          <span className={LABEL}>{t.vendor.pinProduct}</span>

          {products.length === 0 ? (
            <p className="text-[0.65625rem] text-[var(--color-muted)]">{t.common.empty}</p>
          ) : (
            <div className="no-sb flex max-h-[160px] flex-col gap-1 overflow-y-auto">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() =>
                    setPinnedProductId(product.id === pinnedProductId ? null : product.id)
                  }
                  className={cx(
                    "flex items-center gap-2 rounded-[12px] px-2 py-2 text-start",
                    pinnedProductId === product.id
                      ? "bg-[var(--color-brand-fill)] text-white"
                      : "hover:bg-[var(--color-brand-tint)]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[0.71875rem] font-semibold">
                    {product.name}
                  </span>
                  <span className="flex-none text-[0.6875rem] font-bold">
                    {formatPrice(product.price, locale)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Divider />

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>{t.vendor.livediscount}</span>
              <input
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                inputMode="numeric"
                className={FIELD}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>{t.vendor.offerDuration}</span>
              <input
                value={offerMinutes}
                onChange={(e) => setOfferMinutes(e.target.value)}
                inputMode="numeric"
                className={FIELD}
              />
            </label>
          </div>
        </Card>

        {error && (
          <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <Button block onClick={onCreate} disabled={pending || !title.trim() || !shopApproved}>
          {pending ? t.common.loading : t.vendor.schedule}
        </Button>
      </div>
    </>
  );
}
