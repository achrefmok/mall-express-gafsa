"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { createMyShop } from "@/app/actions/vendor";
import { useI18n } from "@/lib/i18n/provider";
import { uploadImage } from "@/lib/upload";
import { monogram } from "@/lib/format";
import { MotionProvider } from "@/components/ui/motion";
import { Button, Card, Field, Input, Placeholder, Select, Textarea } from "@/components/ui/primitives";
import { ChevronRightIcon, CloseIcon, StoreIcon } from "@/components/ui/icons";
import type { Category } from "@/types/database";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

/**
 * L'invitation « Ouvrir ma boutique » du profil, ouverte dans une feuille.
 *
 * Un commerçant qui se découvre dans l'application remplit son dossier ici,
 * sans quitter la page : nom, catégorie, localisation (ville, adresse,
 * position relevée), contact (téléphone, WhatsApp, Instagram, Facebook),
 * présentation, puis logo et couverture. La demande part « en attente » et
 * l'écran bascule sur une confirmation avant de mener vers l'espace vendeur.
 */
export function BecomeVendorModal({
  categories,
  label,
  trigger,
}: {
  categories: Category[];
  label: string;
  trigger?: ReactNode | ((open: () => void) => ReactNode);
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const sc = t.shopCreate;

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"form" | "sent">("form");
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [city, setCity] = useState("Gafsa");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  function reset() {
    setName("");
    setCategoryId("");
    setCity("Gafsa");
    setAddress("");
    setPhone("");
    setWhatsapp("");
    setInstagram("");
    setFacebook("");
    setDescription("");
    setLogoUrl(null);
    setCoverUrl(null);
    setPosition(null);
    setError(null);
    setStage("form");
  }

  function openSheet() {
    reset();
    setOpen(true);
  }

  async function onUpload(kind: "logo" | "cover", file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      if (kind === "logo") setLogoUrl(publicUrl);
      else setCoverUrl(publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.error);
    }
  }

  function onLocate() {
    if (!("geolocation" in navigator)) {
      setError(sc.locateUnsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(sc.locateRefused);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError(sc.errorName);
      return;
    }
    if (!phone.trim()) {
      setError(sc.errorPhone);
      return;
    }

    startTransition(async () => {
      const result = await createMyShop({
        name,
        categoryId: categoryId || null,
        address,
        phone,
        whatsapp,
        instagram,
        facebookUrl: facebook,
        description,
        logoUrl,
        coverUrl,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStage("sent");
    });
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      {typeof trigger === "function"
        ? trigger(openSheet)
        : trigger ?? (
            <button
              type="button"
              onClick={openSheet}
              className="flex w-full items-center gap-[10px] rounded-[18px] border border-[var(--color-outline)] p-3 text-[var(--color-ink)]"
            >
              <span className="flex-1 text-left text-[0.78125rem] font-semibold">{label}</span>
              <ChevronRightIcon size={14} className="text-[var(--color-faint)]" />
            </button>
          )}

      <AnimatePresence>
        {open && (
          <MotionProvider>
            <m.div
              className="fixed inset-0 z-[75] flex items-end justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Le voile ferme au toucher : le geste attendu d'une feuille. */}
              <button
                type="button"
                aria-label={t.common.close}
                onClick={close}
                className="absolute inset-0 bg-[rgba(30,20,45,0.45)]"
              />

              <m.div
                role="dialog"
                aria-modal="true"
                aria-label={sc.title}
                className="animate-slide-up pb-safe relative flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-t-[24px] bg-[var(--color-surface)] shadow-[0_-10px_40px_rgba(40,25,60,0.28)]"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="mx-auto mt-2 mb-1 h-1 w-10 flex-none rounded-full bg-[var(--color-hairline)]" aria-hidden />

                {stage === "sent" ? (
                  <SentState
                    title={sc.sentTitle}
                    body={sc.sentBody}
                    cta={sc.goToVendor}
                    onClose={() => {
                      close();
                      router.replace("/vendeur");
                      router.refresh();
                    }}
                  />
                ) : (
                  <>
                    <header className="flex flex-none items-center gap-2 px-4 pt-2 pb-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
                        <StoreIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{sc.title}</h2>
                        <p className="text-[0.65625rem] leading-[1.4] text-[var(--color-muted)]">{sc.body}</p>
                      </div>
                      <button
                        type="button"
                        onClick={close}
                        aria-label={t.common.close}
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-app)] text-[var(--color-muted)]"
                      >
                        <CloseIcon size={14} />
                      </button>
                    </header>

                    <form onSubmit={onSubmit} className="no-sb flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-1 pb-6">
                      {/* ─── Identité ─────────────────────────────────── */}
                      <section className="flex flex-none flex-col gap-2">
                        <Field label={sc.shopName}>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            size="sm"
                            autoFocus
                            maxLength={60}
                            placeholder={sc.shopNamePlaceholder}
                          />
                        </Field>

                        <label className="flex flex-col gap-1">
                          <span className={LABEL}>{sc.category}</span>
                          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} size="sm">
                            <option value="">{sc.categoryLater}</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {locale === "ar" ? category.name_ar : category.name_fr}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </section>

                      {/* ─── Localisation ─────────────────────────────── */}
                      <section className="flex flex-none flex-col gap-2">
                        <SectionLabel>{sc.locationTitle}</SectionLabel>
                        <Card className="flex flex-col gap-[10px] p-3">
                          <Field label={sc.city}>
                            <Input value={city} onChange={(e) => setCity(e.target.value)} size="sm" />
                          </Field>
                          <Field label={sc.address}>
                            <Input
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              size="sm"
                              placeholder={sc.addressPlaceholder}
                            />
                          </Field>

                          <div className="flex flex-col gap-1">
                            <span className={LABEL}>Position</span>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                tone="outline"
                                size="sm"
                                disabled={locating}
                                onClick={onLocate}
                              >
                                {locating ? "…" : position ? sc.locateUpdate : sc.locate}
                              </Button>
                              {position && (
                                <span className="text-[0.625rem] text-[var(--color-muted)]">
                                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                                </span>
                              )}
                            </div>
                            <p className="text-[0.5625rem] leading-[1.45] text-[var(--color-faint)]">
                              {sc.locateHint}
                            </p>
                          </div>
                        </Card>
                      </section>

                      {/* ─── Contact ──────────────────────────────────── */}
                      <section className="flex flex-none flex-col gap-2">
                        <SectionLabel>{sc.contact}</SectionLabel>
                        <Card className="flex flex-col gap-[10px] p-3">
                          <Field label={sc.phone}>
                            <Input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              size="sm"
                              type="tel"
                              inputMode="tel"
                              placeholder="+216 …"
                            />
                          </Field>
                          <Field label={sc.whatsapp}>
                            <Input
                              value={whatsapp}
                              onChange={(e) => setWhatsapp(e.target.value)}
                              size="sm"
                              type="tel"
                              inputMode="tel"
                              placeholder={sc.whatsappPlaceholder}
                            />
                          </Field>
                          <Field label={sc.instagram}>
                            <Input
                              value={instagram}
                              onChange={(e) => setInstagram(e.target.value)}
                              size="sm"
                              placeholder={sc.instagramPlaceholder}
                            />
                          </Field>
                          <Field label={sc.facebook}>
                            <Input
                              value={facebook}
                              onChange={(e) => setFacebook(e.target.value)}
                              size="sm"
                              inputMode="url"
                              placeholder={sc.facebookPlaceholder}
                            />
                          </Field>
                        </Card>
                      </section>

                      {/* ─── Présentation ─────────────────────────────── */}
                      <section className="flex flex-none flex-col gap-2">
                        <SectionLabel>{sc.presentation}</SectionLabel>
                        <Card className="p-3">
                          <Field label={sc.description}>
                            <Textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              size="sm"
                              rows={3}
                              maxLength={500}
                              placeholder={sc.descriptionPlaceholder}
                            />
                          </Field>
                        </Card>
                      </section>

                      {/* ─── Identité visuelle ────────────────────────── */}
                      <section className="flex flex-none flex-col gap-2">
                        <SectionLabel>{sc.branding}</SectionLabel>
                        <Card className="flex flex-col gap-2 p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--color-brand-fill)] text-[0.9375rem] font-bold text-white">
                              {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- logo fixe 52px
                                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                monogram(name || "B")
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.71875rem] font-semibold text-[var(--color-ink)]">{sc.logo}</p>
                              <p className="text-[0.625rem] text-[var(--color-muted)]">{sc.logoSpec}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => logoInput.current?.click()}
                              className="flex-none whitespace-nowrap text-[0.65625rem] font-semibold text-[var(--color-brand)]"
                            >
                              {t.common.change}
                            </button>
                            <input
                              ref={logoInput}
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => void onUpload("logo", e.target.files?.[0])}
                            />
                          </div>

                          <div className="overflow-hidden rounded-[12px]">
                            {coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- couverture pleine largeur
                              <img src={coverUrl} alt="" className="h-24 w-full object-cover" />
                            ) : (
                              <Placeholder label={sc.cover} className="h-24 w-full" />
                            )}
                            <button
                              type="button"
                              onClick={() => coverInput.current?.click()}
                              className="w-full py-2 text-[0.65625rem] font-semibold text-[var(--color-brand)]"
                            >
                              {coverUrl ? t.common.change : sc.cover}
                            </button>
                            <input
                              ref={coverInput}
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => void onUpload("cover", e.target.files?.[0])}
                            />
                          </div>
                        </Card>
                      </section>

                      {error && (
                        <p role="status" className="flex-none text-[0.6875rem] font-semibold text-[var(--color-live)]">
                          {error}
                        </p>
                      )}

                      <Button type="submit" block disabled={pending}>
                        {pending ? sc.submitting : sc.submit}
                      </Button>
                    </form>
                  </>
                )}
              </m.div>
            </m.div>
          </MotionProvider>
        )}
      </AnimatePresence>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex-none text-[0.8125rem] font-bold text-[var(--color-ink)]">{children}</h3>
  );
}

function SentState({
  title,
  body,
  cta,
  onClose,
}: {
  title: string;
  body: string;
  cta: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-none flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1.5rem] font-bold text-[var(--color-brand)]">
        ✓
      </span>
      <h2 className="text-[1.0625rem] font-bold text-[var(--color-ink)]">{title}</h2>
      <p className="max-w-[320px] text-[0.75rem] leading-[1.55] text-[var(--color-muted)]">{body}</p>
      <Button block className="mt-3" onClick={onClose}>
        {cta}
      </Button>
    </div>
  );
}
