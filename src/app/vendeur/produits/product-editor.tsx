"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { upsertProduct } from "@/app/actions/vendor";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { Button, Card, Chip, Divider, KeyValueRow, Switch } from "@/components/ui/primitives";
import { ImageIcon, PlusIcon } from "@/components/ui/icons";
import { TopBar } from "@/components/shell/top-bar";
import type { AppLocale, Category, Product } from "@/types/database";

const FIELD =
  "w-full rounded-[14px] border border-[var(--color-outline)] bg-white/60 px-3 py-[10px] text-[12.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]";
const LABEL = "text-[10px] text-[var(--color-muted)]";

/** Création et édition d'un produit. */
export function ProductEditor({
  product,
  categories,
  locale,
}: {
  product: Product | null;
  categories: Category[];
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? "");
  const [nameAr, setNameAr] = useState(product?.name_ar ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(product?.description_ar ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [compareAt, setCompareAt] = useState(
    product?.compare_at_price ? String(product.compare_at_price) : "",
  );
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [threshold, setThreshold] = useState(String(product?.low_stock_threshold ?? 3));
  const [categoryId, setCategoryId] = useState(product?.category_id ?? null);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [colors, setColors] = useState<string[]>(product?.colors ?? []);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [sizeDraft, setSizeDraft] = useState("");
  const [isOnline, setIsOnline] = useState(product?.is_online ?? true);
  const [isDraft, setIsDraft] = useState(product?.is_draft ?? false);
  const [pickup, setPickup] = useState(product?.mall_pickup_available ?? true);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileInput = useRef<HTMLInputElement>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;

    setUploading(true);
    setError(null);

    try {
      const uploaded = await Promise.all(
        Array.from(list)
          .slice(0, 6 - images.length)
          .map((file) => uploadImage("products", file)),
      );
      setImages((current) => [...current, ...uploaded.map((u) => u.publicUrl)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.error);
    } finally {
      setUploading(false);
    }
  }

  function onSave() {
    setError(null);

    startTransition(async () => {
      const result = await upsertProduct({
        id: product?.id,
        name,
        nameAr,
        description,
        descriptionAr,
        price: Number.parseFloat(price.replace(",", ".")) || 0,
        compareAtPrice: compareAt ? Number.parseFloat(compareAt.replace(",", ".")) : null,
        stock: Number.parseInt(stock, 10) || 0,
        lowStockThreshold: Number.parseInt(threshold, 10) || 3,
        categoryId,
        images,
        colors,
        sizes,
        isOnline,
        isDraft,
        mallPickupAvailable: pickup,
      });

      if (result.ok) router.push("/vendeur/produits");
      else setError(result.error);
    });
  }

  return (
    <>
      <TopBar
        title={product ? t.common.edit : t.vendor.addProduct}
        back="/vendeur/produits"
        action={
          <button
            type="button"
            onClick={onSave}
            disabled={pending || uploading || !name.trim()}
            className="text-[11.5px] font-bold text-[var(--color-brand)] disabled:opacity-40"
          >
            {pending ? t.common.saving : t.common.save}
          </button>
        }
      />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        {/* ─── Photos ────────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-2 p-3">
          <span className={LABEL}>Photos</span>
          <div className="no-sb flex gap-2 overflow-x-auto">
            {images.map((url, index) => (
              <div key={url} className="relative h-20 w-20 flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniature locale 80px */}
                <img src={url} alt="" className="h-full w-full rounded-[14px] object-cover" />
                {index === 0 && (
                  <span className="absolute bottom-1 start-1 rounded-[4px] bg-[var(--color-brand)] px-[4px] text-[7px] font-bold text-white">
                    1
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setImages((c) => c.filter((u) => u !== url))}
                  aria-label={t.common.delete}
                  className="absolute end-[2px] top-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(36,31,46,0.72)] text-[11px] leading-none text-white"
                >
                  ✕
                </button>
              </div>
            ))}

            {uploading && <div className="skeleton h-20 w-20 flex-none rounded-[14px]" />}

            {images.length < 6 && !uploading && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label={t.common.add}
                className="flex h-20 w-20 flex-none flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
              >
                <ImageIcon size={16} />
                <span className="text-[9px] font-bold">{t.common.add}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => void onFiles(event.target.files)}
          />
        </Card>

        {/* ─── Identité ──────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-[10px] p-3">
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Nom du produit</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>الاسم بالعربية</span>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
              lang="ar"
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={cx(FIELD, "resize-none")}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>الوصف بالعربية</span>
            <textarea
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              rows={2}
              dir="rtl"
              lang="ar"
              className={cx(FIELD, "resize-none")}
            />
          </label>
        </Card>

        {/* ─── Prix et stock ─────────────────────────────────────────── */}
        <Card className="flex flex-col gap-[10px] p-3">
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Prix ({t.common.currency})</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                className={FIELD}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Prix barré</span>
              <input
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                className={FIELD}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Stock</span>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                inputMode="numeric"
                className={FIELD}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Seuil d&apos;alerte</span>
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                inputMode="numeric"
                className={FIELD}
              />
            </label>
          </div>
        </Card>

        {/* ─── Catégorie ─────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-2 p-3">
          <span className={LABEL}>{t.deals.category}</span>
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
        </Card>

        {/* ─── Variantes ─────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-[10px] p-3">
          <span className={LABEL}>{t.product.colors}</span>
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColors((c) => c.filter((v) => v !== value))}
                aria-label={`${t.common.delete} ${value}`}
                className="h-[30px] w-[30px] rounded-full border border-[var(--color-outline)]"
                style={{ background: value }}
              />
            ))}
            <label className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]">
              <PlusIcon size={13} />
              <input
                type="color"
                className="sr-only"
                onChange={(event) => {
                  const value = event.target.value;
                  setColors((c) => (c.includes(value) ? c : [...c, value]));
                }}
              />
            </label>
          </div>

          <Divider />

          <span className={LABEL}>{t.product.sizes}</span>
          <div className="flex flex-wrap items-center gap-2">
            {sizes.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSizes((s) => s.filter((v) => v !== value))}
                className="rounded-[12px] bg-[var(--color-brand-tint)] px-3 py-1 text-[10.5px] font-semibold text-[var(--color-brand)]"
              >
                {value} ✕
              </button>
            ))}
            <input
              value={sizeDraft}
              onChange={(event) => setSizeDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const value = sizeDraft.trim();
                if (value && !sizes.includes(value)) setSizes((s) => [...s, value]);
                setSizeDraft("");
              }}
              placeholder="S, M, 42…"
              className="w-24 rounded-[12px] border border-dashed border-[rgba(109,75,143,0.4)] px-3 py-1 text-[10.5px] outline-none"
            />
          </div>
        </Card>

        {/* ─── Publication ───────────────────────────────────────────── */}
        <Card className="flex flex-col gap-[10px] p-3">
          <KeyValueRow label={t.vendor.tabsOnline}>
            <Switch checked={isOnline} onChange={setIsOnline} label={t.vendor.tabsOnline} />
          </KeyValueRow>
          <Divider />
          <KeyValueRow label={t.vendor.tabsDrafts}>
            <Switch checked={isDraft} onChange={setIsDraft} label={t.vendor.tabsDrafts} />
          </KeyValueRow>
          <Divider />
          <KeyValueRow label={t.marketplace.pickupTitle}>
            <Switch checked={pickup} onChange={setPickup} label={t.marketplace.pickupTitle} />
          </KeyValueRow>
        </Card>

        {error && (
          <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <Button block onClick={onSave} disabled={pending || uploading || !name.trim()}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </div>
    </>
  );
}
