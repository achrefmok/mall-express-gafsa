"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createDeal } from "@/app/actions/deals";
import { uploadImage } from "@/lib/upload";
import { cx, monogram } from "@/lib/format";
import { Card, Chip, Divider, KeyValueRow, Switch } from "@/components/ui/primitives";
import { CameraIcon, CloseIcon, ImageIcon, PlusIcon } from "@/components/ui/icons";
import type { AppLocale } from "@/types/database";

interface ShopOption {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  mall_level: number | null;
  category: { hue: number } | null;
}

interface CategoryOption {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  hue: number;
}

/** Échéance par défaut : ce soir 22 h, l'usage le plus fréquent. */
function tonightAt22(): string {
  const date = new Date();
  date.setHours(22, 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);

  // Format attendu par <input type="datetime-local"> en heure locale.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Écran 12 — publier un bon plan. */
export function NewDealForm({
  shops,
  categories,
  locale,
}: {
  shops: ShopOption[];
  categories: CategoryOption[];
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [inArabic, setInArabic] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopPickerOpen, setShopPickerOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(tonightAt22);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const selectedShop = shops.find((s) => s.id === shopId) ?? null;

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    setUploading(true);
    setError(null);

    try {
      const uploaded = await Promise.all(
        Array.from(fileList)
          .slice(0, 4 - images.length)
          .map((file) => uploadImage("deals", file)),
      );
      setImages((current) => [...current, ...uploaded.map((u) => u.publicUrl)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.error);
    } finally {
      setUploading(false);
    }
  }

  function onPublish() {
    setError(null);

    startTransition(async () => {
      const result = await createDeal({
        title,
        body: inArabic ? undefined : body,
        bodyAr: inArabic ? body : undefined,
        images,
        shopId: shopId ?? undefined,
        categoryId: categoryId ?? undefined,
        locationLabel: selectedShop?.mall_level != null ? `Niveau ${selectedShop.mall_level}` : undefined,
        // datetime-local est en heure locale : on repasse en ISO.
        expiresAt: new Date(expiresAt).toISOString(),
      });

      if (result.ok) router.push("/bons-plans");
      else setError(result.error);
    });
  }

  const canPublish = title.trim().length >= 3 && !pending && !uploading;

  return (
    <>
      <header className="flex flex-none items-center justify-between px-[18px] pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t.common.close}
          className="-ms-1 p-1 text-[var(--color-ink)]"
        >
          <CloseIcon size={17} />
        </button>
        <h1 className="text-[17px] font-bold tracking-[-0.2px] text-[var(--color-ink)]">
          {t.deals.newTitle}
        </h1>
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish}
          className="text-[11.5px] font-bold text-[var(--color-brand)] disabled:opacity-40"
        >
          {pending ? t.common.loading : t.common.publish}
        </button>
      </header>

      <div className="col-reading no-sb flex flex-1 flex-col gap-[14px] overflow-y-auto px-4 pt-[14px] pb-6">
        {/* ─── Zones de dépôt photo ──────────────────────────────────── */}
        <div className="flex flex-none gap-[10px]">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            disabled={images.length >= 4}
            className="flex h-24 flex-1 flex-col items-center justify-center gap-[6px] rounded-[18px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] bg-[rgba(109,75,143,0.06)] text-[var(--color-brand)] disabled:opacity-40"
          >
            <CameraIcon size={19} />
            <span className="text-[10.5px] font-bold">{t.common.takePhoto}</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            disabled={images.length >= 4}
            className="flex h-24 flex-1 flex-col items-center justify-center gap-[6px] rounded-[18px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] bg-[rgba(109,75,143,0.06)] text-[var(--color-brand)] disabled:opacity-40"
          >
            <ImageIcon size={19} />
            <span className="text-[10.5px] font-bold">{t.common.gallery}</span>
          </button>
        </div>

        {/* `capture` ouvre directement l'appareil photo sur mobile. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => void onFiles(event.target.files)}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => void onFiles(event.target.files)}
        />

        {(images.length > 0 || uploading) && (
          <div className="no-sb flex flex-none gap-2 overflow-x-auto">
            {images.map((url) => (
              <div key={url} className="relative h-16 w-16 flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniature locale 64px */}
                <img src={url} alt="" className="h-full w-full rounded-[14px] object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((current) => current.filter((u) => u !== url))}
                  aria-label={t.common.delete}
                  className="absolute end-[2px] top-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(36,31,46,0.72)] text-[11px] leading-none text-white"
                >
                  ✕
                </button>
              </div>
            ))}

            {uploading && <div className="skeleton h-16 w-16 flex-none rounded-[14px]" />}

            {images.length < 4 && !uploading && (
              <button
                type="button"
                onClick={() => galleryInput.current?.click()}
                aria-label={t.common.add}
                className="flex h-16 w-16 flex-none items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
              >
                <PlusIcon size={17} />
              </button>
            )}
          </div>
        )}

        {/* ─── Statut ───────────────────────────────────────────────── */}
        <Card className="flex flex-none flex-col gap-[9px] p-3">
          <span className="text-[10.5px] text-[var(--color-muted)]">{t.deals.yourStatus}</span>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            placeholder={t.deals.titlePlaceholder}
            aria-label={t.deals.titlePlaceholder}
            dir={inArabic ? "rtl" : undefined}
            className="bg-transparent text-[12.5px] font-semibold leading-[1.45] text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-faint)]"
          />

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t.deals.bodyPlaceholder}
            aria-label={t.deals.bodyPlaceholder}
            dir={inArabic ? "rtl" : undefined}
            lang={inArabic ? "ar" : undefined}
            className="resize-none bg-transparent text-[11.5px] leading-[1.5] text-[var(--color-muted)] outline-none placeholder:text-[var(--color-faint)]"
          />

          <Divider />

          <KeyValueRow label={<span className="text-[10.5px] text-[var(--color-muted)]">{t.deals.writeInArabic}</span>}>
            <Switch checked={inArabic} onChange={setInArabic} label={t.deals.writeInArabic} />
          </KeyValueRow>
        </Card>

        {/* ─── Boutique, catégorie, échéance ────────────────────────── */}
        <Card className="flex flex-none flex-col gap-[10px] p-3">
          <span className="text-[10.5px] text-[var(--color-muted)]">{t.deals.shopConcerned}</span>

          <div className="flex items-center gap-[9px]">
            {selectedShop ? (
              <>
                <span
                  className="cat-surface cat-ink flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ "--hue": selectedShop.category?.hue ?? 300 } as React.CSSProperties}
                >
                  {monogram(selectedShop.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-[var(--color-ink)]">
                  {selectedShop.name}
                  {selectedShop.mall_level != null && ` — Niveau ${selectedShop.mall_level}`}
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1 text-[11.5px] text-[var(--color-faint)]">
                {t.common.empty}
              </span>
            )}

            <button
              type="button"
              onClick={() => setShopPickerOpen((v) => !v)}
              className="flex-none text-[10.5px] font-bold text-[var(--color-brand)]"
            >
              {t.common.change}
            </button>
          </div>

          {shopPickerOpen && (
            <div className="no-sb max-h-40 overflow-y-auto rounded-[12px] border border-[var(--color-hairline)]">
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => {
                    setShopId(shop.id === shopId ? null : shop.id);
                    setShopPickerOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-[11.5px]",
                    shop.id === shopId
                      ? "bg-[var(--color-brand)] text-white"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-brand-tint)]",
                  )}
                >
                  {shop.name}
                </button>
              ))}
            </div>
          )}

          <Divider />

          <span className="text-[10.5px] text-[var(--color-muted)]">{t.deals.category}</span>
          <div className="flex flex-wrap gap-[6px]">
            {categories.map((category) => (
              <Chip
                key={category.id}
                tone="category"
                hue={category.hue}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id === categoryId ? null : category.id)}
                className="px-[11px] py-[5px] text-[10px]"
              >
                {locale === "ar" ? category.name_ar : category.name_fr}
              </Chip>
            ))}
          </div>

          <Divider />

          <KeyValueRow label={<span className="text-[var(--color-muted)]">{t.deals.validUntil}</span>}>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              aria-label={t.deals.validUntil}
              className="rounded-[10px] bg-[var(--color-brand-tint)] px-2 py-1 text-[11px] font-bold text-[var(--color-ink)] outline-none"
            />
          </KeyValueRow>
        </Card>

        {/* ─── Encart pédagogique ───────────────────────────────────── */}
        <div className="flex flex-none items-center gap-[10px] rounded-[18px] bg-[var(--color-brand-tint)] p-[11px_12px]">
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[var(--color-brand)] text-[12px] font-bold text-white">
            i
          </span>
          <p className="text-[10.5px] leading-[1.45] text-[var(--color-ink)]">{t.deals.hint}</p>
        </div>

        {error && (
          <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
