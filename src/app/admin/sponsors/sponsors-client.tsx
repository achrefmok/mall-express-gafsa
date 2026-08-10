"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createSponsoredSlot, toggleSponsoredSlot } from "@/app/actions/admin";
import { uploadImage } from "@/lib/upload";
import { cx, formatDateTime } from "@/lib/format";
import { Button, Card, Divider, EmptyState, KeyValueRow, Placeholder, Switch } from "@/components/ui/primitives";
import { ImageIcon } from "@/components/ui/icons";
import type { AppLocale, SponsoredSlot } from "@/types/database";

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-white px-3 py-[8px] text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]";
const LABEL = "text-[10px] text-[var(--color-muted)]";

function inThirtyDays(): string {
  const date = new Date(Date.now() + 30 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function SponsorsManager({
  slots,
  shops,
  locale,
}: {
  slots: SponsoredSlot[];
  shops: Array<{ id: string; name: string }>;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [advertiser, setAdvertiser] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [shopId, setShopId] = useState("");
  const [endsAt, setEndsAt] = useState(inThirtyDays);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileInput = useRef<HTMLInputElement>(null);

  async function onImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      setImageUrl(publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.error);
    } finally {
      setUploading(false);
    }
  }

  function onCreate() {
    setError(null);

    startTransition(async () => {
      const result = await createSponsoredSlot({
        advertiser,
        title,
        subtitle,
        linkUrl,
        shopId: shopId || undefined,
        imageUrl,
        endsAt: new Date(`${endsAt}T23:59`).toISOString(),
        position: slots.length + 1,
      });

      if (result.ok) {
        setAdvertiser("");
        setTitle("");
        setSubtitle("");
        setLinkUrl("");
        setImageUrl(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      {slots.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          body="Les emplacements sponsorisés apparaissent en tête du fil d'accueil."
        />
      ) : (
        slots.map((slot) => <SlotRow key={slot.id} slot={slot} locale={locale} />)
      )}

      <Card className="flex flex-none flex-col gap-2 p-3">
        <p className="text-[11px] font-bold text-[var(--color-ink)]">{t.common.add}</p>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Annonceur</span>
          <input
            value={advertiser}
            onChange={(e) => setAdvertiser(e.target.value)}
            placeholder="Banque de Tunisie"
            className={cx(FIELD, "placeholder:text-[var(--color-faint)]")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Sous-titre</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={FIELD} />
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className={LABEL}>Boutique liée</span>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className={FIELD}
            >
              <option value="">— aucune —</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <span className={LABEL}>Jusqu&apos;au</span>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Lien externe (facultatif)</span>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            type="url"
            inputMode="url"
            placeholder="https://…"
            className={cx(FIELD, "placeholder:text-[var(--color-faint)]")}
          />
        </label>

        <span className={LABEL}>Bannière</span>
        {imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
            <img src={imageUrl} alt="" className="h-24 w-full rounded-[14px] object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              aria-label={t.common.delete}
              className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(36,31,46,0.7)] text-[10px] text-white"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
          >
            <ImageIcon size={17} />
            <span className="text-[10px] font-bold">
              {uploading ? t.common.loading : t.common.add}
            </span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void onImage(event.target.files?.[0])}
        />

        {error && (
          <p role="alert" className="text-[10.5px] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <Button
          size="sm"
          block
          onClick={onCreate}
          disabled={pending || uploading || !advertiser.trim() || !title.trim()}
        >
          {pending ? t.common.loading : t.common.add}
        </Button>
      </Card>
    </div>
  );
}

function SlotRow({ slot, locale }: { slot: SponsoredSlot; locale: AppLocale }) {
  const { t } = useI18n();
  const router = useRouter();

  const [active, setActive] = useState(slot.is_active);
  const [pending, startTransition] = useTransition();

  const expired = new Date(slot.ends_at).getTime() <= Date.now();

  return (
    <Card className={cx("flex flex-none flex-col gap-2 overflow-hidden p-0", expired && "opacity-60")}>
      {slot.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- bannière pleine largeur
        <img src={slot.image_url} alt="" className="h-20 w-full object-cover" />
      ) : (
        <Placeholder label="bannière — annonceur" className="h-20 w-full" />
      )}

      <div className="flex flex-col gap-2 p-3 pt-0">
        <div>
          <p className="text-[11.5px] font-bold text-[var(--color-ink)]">{slot.title}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {slot.advertiser} · {expired ? t.deals.expired : formatDateTime(slot.ends_at, locale)}
          </p>
        </div>

        <Divider />

        <KeyValueRow label={<span className="text-[var(--color-muted)]">Diffusion</span>}>
          <Switch
            checked={active}
            disabled={pending || expired}
            label={slot.title}
            onChange={(next) => {
              setActive(next);
              startTransition(async () => {
                const result = await toggleSponsoredSlot(slot.id, next);
                if (result.ok) router.refresh();
                else setActive(!next);
              });
            }}
          />
        </KeyValueRow>

        <p className="text-[9.5px] text-[var(--color-faint)]">
          {slot.impressions} affichages · {slot.clicks} clics
        </p>
      </div>
    </Card>
  );
}
