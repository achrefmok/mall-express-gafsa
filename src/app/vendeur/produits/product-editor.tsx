"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { upsertProduct, upsertProductAttributes, upsertProductMateriaux } from "@/app/actions/vendor";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { Button, Card, Chip, Divider, KeyValueRow, Switch, fieldClass } from "@/components/ui/primitives";
import { CameraIcon, ImageIcon, PlusIcon } from "@/components/ui/icons";
import { TopBar } from "@/components/shell/top-bar";
import { VariantImageEditor } from "./variant-images";
import { AttributFields } from "./attribute-fields";
import type { ThemeId } from "@/lib/boutique-themes";
import type { AppLocale, Category, Product } from "@/types/database";

const FIELD =
  fieldClass({});
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

/** Création et édition d'un produit. */
export function ProductEditor({
  product,
  categories,
  categoriesFiltrees = true,
  locale,
  familleId,
  attributsInitiaux = {},
  materiauxInitiaux = [],
}: {
  product: Product | null;
  categories: Category[];
  /**
   * Faux quand la boutique n'a déclaré aucun type : toutes les catégories du
   * mall sont alors proposées, et l'on invite à les restreindre.
   */
  categoriesFiltrees?: boolean;
  locale: AppLocale;
  /** Le thème de la boutique — pilote quels champs par métier s'affichent. */
  familleId: ThemeId;
  attributsInitiaux?: Record<string, string>;
  materiauxInitiaux?: string[];
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
  const [attributs, setAttributs] = useState<Record<string, string>>(attributsInitiaux);
  const [materiaux, setMateriaux] = useState<string[]>(materiauxInitiaux);

  const [uploading, setUploading] = useState(false);
  const [definitionFaible, setDefinitionFaible] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

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

      /*
        L'avertissement de définition va au vendeur, jamais au client.

        Une photo de six cents pixels restera molle une fois agrandie, quoi que
        fasse l'affichage — et rien ne le rattrape après coup : agrandir invente
        des pixels, cela ne les retrouve pas. Le seul moment où l'information
        sert est celui-ci, où reprendre la photo ne coûte qu'un geste. Le dire
        au client, lui, ne lui donnerait aucun moyen d'agir.
      */
      const molles = uploaded.filter((u) => u.basseDefinition).length;
      setDefinitionFaible(molles > 0 ? molles : null);
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

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Les deux tolèrent l'absence de leur migration (voir vendor.ts) :
      // un échec ici n'empêche jamais d'enregistrer le produit lui-même.
      await Promise.all([
        upsertProductAttributes(result.data.id, attributs),
        upsertProductMateriaux(result.data.id, materiaux),
      ]);

      router.push("/vendeur/produits");
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
            className="text-[0.71875rem] font-bold text-[var(--color-brand)] disabled:opacity-40"
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
                  <span className="absolute bottom-1 start-1 rounded-[4px] bg-[var(--color-brand-fill)] px-[4px] text-[0.4375rem] font-bold text-white">
                    1
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setImages((c) => c.filter((u) => u !== url))}
                  aria-label={t.common.delete}
                  className="absolute end-[2px] top-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(36,31,46,0.72)] text-[0.6875rem] leading-none text-white"
                >
                  ✕
                </button>
              </div>
            ))}

            {uploading && <div className="skeleton h-20 w-20 flex-none rounded-[14px]" />}

            {images.length < 6 && !uploading && (
              <>
                <button
                  type="button"
                  onClick={() => cameraInput.current?.click()}
                  aria-label={t.common.takePhoto}
                  className="flex h-20 w-20 flex-none flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
                >
                  <CameraIcon size={16} />
                  <span className="text-[0.5625rem] font-bold">{t.common.takePhoto}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label={t.common.gallery}
                  className="flex h-20 w-20 flex-none flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
                >
                  <ImageIcon size={16} />
                  <span className="text-[0.5625rem] font-bold">{t.common.gallery}</span>
                </button>
              </>
            )}
          </div>

          {/* `capture` ouvre directement l'appareil photo sur mobile. */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(event) => void onFiles(event.target.files)}
          />
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
          {!categoriesFiltrees && (
            <p className="text-[0.625rem] leading-[1.45] text-[var(--color-muted)]">
              {t.vendeur.categoriesHint}
            </p>
          )}
          <div className="flex flex-wrap gap-[6px]">
            {categories.map((category) => (
              <Chip
                key={category.id}
                tone="category"
                hue={category.hue}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id === categoryId ? null : category.id)}
                className="px-[11px] py-[5px] text-[0.625rem]"
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

          {/*
            Le rattachement photo/couleur n'existe qu'une fois l'article
            enregistré : il écrit directement en base sur un identifiant de
            produit, alors que le reste du formulaire n'est envoyé qu'à la
            validation. Sur une création, la section apparaît au second passage.

            Il lit `colors` — l'état vivant du formulaire — et non la valeur
            enregistrée : une couleur ajoutée à l'instant peut recevoir sa photo
            sans qu'on ait à enregistrer d'abord.
          */}
          {product && (
            <VariantImageEditor
              productId={product.id}
              colors={colors}
              images={images}
              initial={product.variant_images ?? {}}
            />
          )}

          <Divider />

          <span className={LABEL}>{t.product.sizes}</span>
          <div className="flex flex-wrap items-center gap-2">
            {sizes.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSizes((s) => s.filter((v) => v !== value))}
                className="rounded-[12px] bg-[var(--color-brand-tint)] px-3 py-1 text-[0.65625rem] font-semibold text-[var(--color-brand)]"
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
              className="w-24 rounded-[12px] border border-dashed border-[rgba(109,75,143,0.4)] px-3 py-1 text-[0.65625rem] outline-none"
            />
          </div>
        </Card>

        {/* ─── Champs par métier ─────────────────────────────────────── */}
        <AttributFields
          familleId={familleId}
          categoryId={categoryId}
          categories={categories}
          value={attributs}
          onChange={setAttributs}
          materiaux={materiaux}
          onChangeMateriaux={setMateriaux}
        />

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

        {definitionFaible !== null && (
          <p className="rounded-[12px] bg-[var(--color-field)] px-3 py-[10px] text-[0.625rem] leading-[1.5] text-[var(--color-muted)]">
            {t.vendor.lowResolution.replace("{n}", String(definitionFaible))}
          </p>
        )}

        {error && (
          <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
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
