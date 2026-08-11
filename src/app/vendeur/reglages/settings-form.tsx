"use client";

import Link from "next/link";
import { Suspense, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  updateShopCategories,
  updateShopHours,
  updateShopSettings,
} from "@/app/actions/vendor";
import { uploadImage } from "@/lib/upload";
import { cx, monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, Chip, Divider, KeyValueRow, Placeholder, SectionTitle, Switch } from "@/components/ui/primitives";
import { FacebookLink, type FacebookLinkStatus } from "./facebook-link";
import type { AppLocale, Category, Shop } from "@/types/database";

interface DayHours {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-white/60 px-3 py-[8px] text-[12.5px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]";

/** Écran 10 — réglages boutique. */
export function ShopSettingsForm({
  shop,
  hours: initialHours,
  categories,
  selectedCategoryIds,
  locale,
  facebookStatus,
  facebookConfigured,
}: {
  shop: Shop;
  hours: DayHours[];
  categories: Category[];
  selectedCategoryIds: string[];
  locale: AppLocale;
  facebookStatus: FacebookLinkStatus;
  facebookConfigured: boolean;
}) {
  const { t } = useI18n();

  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [mallLevel, setMallLevel] = useState(shop.mall_level?.toString() ?? "");
  const [mallUnit, setMallUnit] = useState(shop.mall_unit ?? "");
  const [address, setAddress] = useState(shop.address ?? "");
  const [logoUrl, setLogoUrl] = useState(shop.logo_url);
  const [bannerUrl, setBannerUrl] = useState(shop.banner_url);
  const [hours, setHours] = useState(initialHours);
  const [selected, setSelected] = useState<string[]>(selectedCategoryIds);
  const [delivers, setDelivers] = useState(shop.delivers_in_gafsa);
  const [pickup, setPickup] = useState(shop.pickup_in_store);
  const [openNow, setOpenNow] = useState(shop.is_open_now);
  const [preview, setPreview] = useState(false);

  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function onUpload(kind: "logo" | "banner", file: File | undefined) {
    if (!file) return;
    setFeedback(null);

    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      if (kind === "logo") setLogoUrl(publicUrl);
      else setBannerUrl(publicUrl);
    } catch (cause) {
      setFeedback({ kind: "error", message: cause instanceof Error ? cause.message : t.common.error });
    }
  }

  function onSave() {
    setFeedback(null);

    startTransition(async () => {
      const results = await Promise.all([
        updateShopSettings({
          name,
          phone,
          logoUrl,
          bannerUrl,
          mallLevel: mallLevel === "" ? null : Number.parseInt(mallLevel, 10),
          mallUnit,
          address,
          deliversInGafsa: delivers,
          pickupInStore: pickup,
          isOpenNow: openNow,
        }),
        updateShopHours(hours),
        updateShopCategories(selected),
      ]);

      const failed = results.find((result) => !result.ok);
      setFeedback(
        failed && !failed.ok
          ? { kind: "error", message: failed.error }
          : { kind: "ok", message: t.common.saved },
      );
    });
  }

  function setDay(weekday: number, patch: Partial<DayHours>) {
    setHours((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  return (
    <>
      <TopBar
        title={t.vendor.shopSettings}
        back="/vendeur"
        action={
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="text-[11.5px] font-semibold text-[var(--color-brand)] disabled:opacity-40"
          >
            {pending ? t.common.saving : t.common.save}
          </button>
        }
      />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[14px] pb-6">
        {/* ─── Direct Facebook ───────────────────────────────────────── */}
        <Suspense fallback={null}>
          <FacebookLink
            status={facebookStatus}
            configured={facebookConfigured}
            locale={locale}
          />
        </Suspense>

        {/* ─── Aperçu client ─────────────────────────────────────────── */}
        <Card className="flex flex-none items-center gap-[10px] p-3">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[13px] font-bold text-[var(--color-brand)]">
            AP
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold text-[var(--color-ink)]">{t.vendor.clientPreview}</p>
            <p className="text-[10.5px] text-[var(--color-muted)]">{t.vendor.clientPreviewBody}</p>
          </div>
          <Switch checked={preview} onChange={setPreview} label={t.vendor.clientPreview} />
        </Card>

        {preview && shop.status === "approved" && (
          <Link
            href={`/boutique/${shop.slug}`}
            className="-mt-2 flex-none rounded-[14px] bg-[var(--color-brand)] px-3 py-2 text-center text-[11.5px] font-bold text-white"
          >
            {t.product.seeShop}
          </Link>
        )}

        {/* ─── Identité ──────────────────────────────────────────────── */}
        <section id="identite" className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.identity}</SectionTitle>

          <Card className="flex items-center gap-3 p-3">
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--color-brand)] text-[15px] font-bold text-white">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo fixe 52px
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                monogram(name)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold text-[var(--color-ink)]">{t.vendor.shopLogo}</p>
              <p className="text-[10.5px] text-[var(--color-muted)]">{t.vendor.logoSpec}</p>
            </div>
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="flex-none whitespace-nowrap text-[10.5px] font-semibold text-[var(--color-brand)]"
            >
              {t.common.change}
            </button>
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void onUpload("logo", event.target.files?.[0])}
            />
          </Card>

          <Card className="overflow-hidden">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- bannière pleine largeur
              <img src={bannerUrl} alt="" className="h-24 w-full object-cover" />
            ) : (
              <Placeholder label="bannière de la boutique" className="h-24 w-full" />
            )}
            <button
              type="button"
              onClick={() => bannerInput.current?.click()}
              className="w-full py-2 text-[10.5px] font-semibold text-[var(--color-brand)]"
            >
              {t.vendor.editBanner}
            </button>
            <input
              ref={bannerInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void onUpload("banner", event.target.files?.[0])}
            />
          </Card>

          <Card className="flex flex-col gap-2 p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-[var(--color-muted)]">{t.vendor.shopName}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-[var(--color-muted)]">{t.cart.contactPhone}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                className={FIELD}
              />
            </label>

            <Divider />

            <span className="text-[10.5px] text-[var(--color-muted)]">{t.vendor.soldCategories}</span>
            <div className="flex flex-wrap gap-[6px]">
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  tone="tinted"
                  active={selected.includes(category.id)}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(category.id)
                        ? current.filter((id) => id !== category.id)
                        : [...current, category.id],
                    )
                  }
                  className="px-[11px] py-[5px] text-[10px]"
                >
                  {locale === "ar" ? category.name_ar : category.name_fr}
                </Chip>
              ))}
            </div>
          </Card>
        </section>

        {/* ─── Horaires ──────────────────────────────────────────────── */}
        <section id="horaires" className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.workingHours}</SectionTitle>

          <Card className="flex flex-col gap-[9px] p-3">
            {hours.map((day) => (
              <KeyValueRow key={day.weekday} label={t.vendor.weekdays[day.weekday]}>
                {day.isClosed ? (
                  <button
                    type="button"
                    onClick={() => setDay(day.weekday, { isClosed: false })}
                    className="text-[11.5px] font-semibold text-[var(--color-live)]"
                  >
                    {t.vendor.closedDay}
                  </button>
                ) : (
                  <span className="flex items-center gap-1">
                    <input
                      type="time"
                      value={day.opensAt}
                      onChange={(e) => setDay(day.weekday, { opensAt: e.target.value })}
                      aria-label={`${t.vendor.weekdays[day.weekday]} — ouverture`}
                      className="rounded-[8px] bg-[var(--color-brand-tint)] px-1 py-[2px] text-[11px] font-semibold outline-none"
                    />
                    <span aria-hidden className="text-[var(--color-faint)]">
                      —
                    </span>
                    <input
                      type="time"
                      value={day.closesAt}
                      onChange={(e) => setDay(day.weekday, { closesAt: e.target.value })}
                      aria-label={`${t.vendor.weekdays[day.weekday]} — fermeture`}
                      className="rounded-[8px] bg-[var(--color-brand-tint)] px-1 py-[2px] text-[11px] font-semibold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDay(day.weekday, { isClosed: true })}
                      aria-label={`${t.vendor.weekdays[day.weekday]} — ${t.vendor.closedDay}`}
                      className="ms-1 text-[10px] text-[var(--color-faint)]"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </KeyValueRow>
            ))}

            <Divider />

            <KeyValueRow label={t.vendor.openNow}>
              <Switch checked={openNow} onChange={setOpenNow} label={t.vendor.openNow} />
            </KeyValueRow>
          </Card>
        </section>

        {/* ─── Localisation & livraison ──────────────────────────────── */}
        <section id="localisation" className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.locationDelivery}</SectionTitle>

          <Card className="overflow-hidden">
            {/* La carte reste un emplacement tant qu'aucun fournisseur
                cartographique n'est branché : mieux vaut une zone honnête
                qu'une image décorative qui ne localise rien. */}
            <Placeholder label="carte — emplacement du magasin" className="h-[88px] w-full" />

            <div className="flex flex-col gap-2 p-3">
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[10.5px] text-[var(--color-muted)]">Niveau</span>
                  <input
                    value={mallLevel}
                    onChange={(e) => setMallLevel(e.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[10.5px] text-[var(--color-muted)]">Local</span>
                  <input
                    value={mallUnit}
                    onChange={(e) => setMallUnit(e.target.value)}
                    placeholder="B12"
                    className={FIELD}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-[var(--color-muted)]">Adresse</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={FIELD}
                />
              </label>

              <Divider />

              <KeyValueRow label={t.vendor.deliverGafsa}>
                <Switch checked={delivers} onChange={setDelivers} label={t.vendor.deliverGafsa} />
              </KeyValueRow>
              <KeyValueRow label={t.vendor.pickupStore}>
                <Switch checked={pickup} onChange={setPickup} label={t.vendor.pickupStore} />
              </KeyValueRow>
            </div>
          </Card>
        </section>

        {feedback && (
          <p
            role="status"
            className={cx(
              "text-[11px] font-semibold",
              feedback.kind === "ok" ? "text-[var(--color-brand)]" : "text-[var(--color-live)]",
            )}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </>
  );
}
