"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createSponsoredSlot, toggleSponsoredSlot, updateSponsoredSlot } from "@/app/actions/admin";
import { uploadImage } from "@/lib/upload";
import { cx, formatDateTime } from "@/lib/format";
import { Button, Card, Divider, EmptyState, KeyValueRow, Placeholder, Switch, fieldClass } from "@/components/ui/primitives";
import { ImageIcon } from "@/components/ui/icons";
import type { AppLocale, SponsoredSlot } from "@/types/database";

/** Emplacement, avec la boutique jointe quand il en vise une. */
type SlotWithShop = SponsoredSlot & {
  shop: { slug: string; name: string; status: string } | null;
};

const FIELD = fieldClass({ size: "sm", solid: true });
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

const pad = (n: number) => String(n).padStart(2, "0");
/** Une date de calendrier locale, pour un champ `type="date"`. */
function jourLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface ValeursAffiche {
  advertiser: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  shopId: string;
  startsAt: string;
  endsAt: string;
  position: string;
  imageUrl: string | null;
}

/**
 * La régie des affiches de l'accueil.
 *
 * Elle permettait de créer une affiche et de couper sa diffusion — pas de la
 * corriger. Une faute dans le titre, une image à remplacer, une date à
 * prolonger : il fallait en créer une seconde, et l'ancienne restait dans la
 * liste. Chaque affiche se modifie désormais sur place, sans doublon — la même
 * ligne est mise à jour.
 */
export function SponsorsManager({
  slots,
  shops,
  locale,
}: {
  slots: SlotWithShop[];
  shops: Array<{ id: string; name: string }>;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const vide: ValeursAffiche = {
    advertiser: "",
    title: "",
    subtitle: "",
    linkUrl: "",
    shopId: "",
    startsAt: jourLocal(new Date()),
    endsAt: jourLocal(new Date(Date.now() + 30 * 86_400_000)),
    position: String(slots.length + 1),
    imageUrl: null,
  };

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      {slots.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          body="Les emplacements sponsorisés apparaissent en tête du fil d'accueil."
        />
      ) : (
        slots.map((slot) => <SlotRow key={slot.id} slot={slot} shops={shops} locale={locale} />)
      )}

      <Card className="flex flex-none flex-col gap-2 p-3">
        <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">{t.common.add}</p>
        <FormulaireAffiche
          key={slots.length}
          initial={vide}
          shops={shops}
          libelle={t.common.add}
          onEnvoi={async (v) => {
            const r = await createSponsoredSlot({
              advertiser: v.advertiser,
              title: v.title,
              subtitle: v.subtitle,
              linkUrl: v.linkUrl,
              shopId: v.shopId || undefined,
              imageUrl: v.imageUrl,
              startsAt: new Date(`${v.startsAt}T00:00`).toISOString(),
              endsAt: new Date(`${v.endsAt}T23:59`).toISOString(),
              position: Number.parseInt(v.position, 10) || slots.length + 1,
            });
            if (r.ok) router.refresh();
            return r;
          }}
        />
      </Card>
    </div>
  );
}

/** Les champs d'une affiche, pour la créer comme pour la modifier. */
function FormulaireAffiche({
  initial,
  shops,
  libelle,
  onEnvoi,
  onAnnuler,
}: {
  initial: ValeursAffiche;
  shops: Array<{ id: string; name: string }>;
  libelle: string;
  onEnvoi: (valeurs: ValeursAffiche) => Promise<{ ok: boolean; error?: string }>;
  onAnnuler?: () => void;
}) {
  const { t } = useI18n();
  const [v, setV] = useState<ValeursAffiche>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const maj = <K extends keyof ValeursAffiche>(cle: K, valeur: ValeursAffiche[K]) =>
    setV((courant) => ({ ...courant, [cle]: valeur }));

  async function onImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      maj("imageUrl", publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.error);
    } finally {
      setUploading(false);
    }
  }

  function envoyer() {
    setError(null);
    startTransition(async () => {
      const r = await onEnvoi(v);
      if (!r.ok) setError(r.error ?? t.common.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Annonceur</span>
        <input
          value={v.advertiser}
          onChange={(e) => maj("advertiser", e.target.value)}
          placeholder="Banque de Tunisie"
          className={cx(FIELD, "placeholder:text-[var(--color-faint)]")}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Titre</span>
        <input value={v.title} onChange={(e) => maj("title", e.target.value)} className={FIELD} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Description</span>
        <input value={v.subtitle} onChange={(e) => maj("subtitle", e.target.value)} className={FIELD} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Du</span>
          <input type="date" value={v.startsAt} onChange={(e) => maj("startsAt", e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Jusqu&apos;au</span>
          <input type="date" value={v.endsAt} onChange={(e) => maj("endsAt", e.target.value)} className={FIELD} />
        </label>
      </div>

      <div className="grid grid-cols-[1fr_88px] gap-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Boutique liée</span>
          <select value={v.shopId} onChange={(e) => maj("shopId", e.target.value)} className={FIELD}>
            <option value="">— aucune —</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Ordre</span>
          <input
            value={v.position}
            onChange={(e) => maj("position", e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            className={FIELD}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Lien externe (facultatif)</span>
        <input
          value={v.linkUrl}
          onChange={(e) => maj("linkUrl", e.target.value)}
          type="url"
          inputMode="url"
          placeholder="https://…"
          className={cx(FIELD, "placeholder:text-[var(--color-faint)]")}
        />
      </label>

      <span className={LABEL}>Image</span>
      {v.imageUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
          <img src={v.imageUrl} alt="" className="aspect-[2/1] w-full rounded-[14px] object-cover" />
          <div className="absolute end-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-full bg-[rgba(36,31,46,0.7)] px-2 py-1 text-[0.625rem] font-bold text-white"
            >
              {t.common.change}
            </button>
            <button
              type="button"
              onClick={() => maj("imageUrl", null)}
              aria-label={t.common.delete}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(36,31,46,0.7)] text-[0.625rem] text-white"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
        >
          <ImageIcon size={17} />
          <span className="text-[0.625rem] font-bold">{uploading ? t.common.loading : t.common.add}</span>
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
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onAnnuler && (
          <Button size="sm" onClick={onAnnuler} disabled={pending}>
            {t.common.cancel}
          </Button>
        )}
        <Button
          size="sm"
          block
          onClick={envoyer}
          disabled={pending || uploading || !v.advertiser.trim() || !v.title.trim()}
        >
          {pending ? t.common.loading : libelle}
        </Button>
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  shops,
  locale,
}: {
  slot: SlotWithShop;
  shops: Array<{ id: string; name: string }>;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [active, setActive] = useState(slot.is_active);
  const [edition, setEdition] = useState(false);
  const [pending, startTransition] = useTransition();

  const expired = new Date(slot.ends_at).getTime() <= Date.now();

  if (edition) {
    return (
      <Card className="flex flex-none flex-col gap-2 p-3">
        <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
          {t.common.edit} — {slot.title}
        </p>
        <FormulaireAffiche
          initial={{
            advertiser: slot.advertiser ?? "",
            title: slot.title,
            subtitle: slot.subtitle ?? "",
            linkUrl: slot.link_url ?? "",
            shopId: slot.shop_id ?? "",
            startsAt: jourLocal(new Date(slot.starts_at)),
            endsAt: jourLocal(new Date(slot.ends_at)),
            position: String(slot.position ?? 0),
            imageUrl: slot.image_url,
          }}
          shops={shops}
          libelle={t.common.save}
          onAnnuler={() => setEdition(false)}
          onEnvoi={async (v) => {
            const r = await updateSponsoredSlot(slot.id, {
              advertiser: v.advertiser,
              title: v.title,
              subtitle: v.subtitle,
              linkUrl: v.linkUrl,
              shopId: v.shopId || undefined,
              imageUrl: v.imageUrl,
              startsAt: new Date(`${v.startsAt}T00:00`).toISOString(),
              endsAt: new Date(`${v.endsAt}T23:59`).toISOString(),
              position: Number.parseInt(v.position, 10) || 0,
            });
            if (r.ok) {
              setEdition(false);
              router.refresh();
            }
            return r;
          }}
        />
      </Card>
    );
  }

  return (
    <Card className={cx("flex flex-none flex-col gap-2 overflow-hidden p-0", expired && "opacity-60")}>
      {slot.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- bannière pleine largeur
        <img src={slot.image_url} alt="" className="h-24 w-full object-cover" />
      ) : (
        <Placeholder label="bannière — annonceur" className="h-24 w-full" />
      )}

      <div className="flex flex-col gap-2 p-3 pt-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">{slot.title}</p>
            <p className="text-[0.625rem] text-[var(--color-muted)]">
              {slot.advertiser} · #{slot.position} ·{" "}
              {expired ? t.deals.expired : formatDateTime(slot.ends_at, locale)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEdition(true)}
            className="min-h-9 flex-none rounded-full bg-[var(--color-brand-tint)] px-3 text-[0.65625rem] font-bold text-[var(--color-brand)]"
          >
            {t.common.edit}
          </button>
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

        {/*
          Où mène réellement cet emplacement — et le vérifier d'un toucher.

          Une boutique approuvée : son nom et un lien vers sa vitrine. Une
          boutique suspendue : on le dit, et le lien disparaît. Une adresse
          libre : on la montre telle quelle.
        */}
        <Divider />

        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[0.59375rem] text-[var(--color-faint)]">Destination</span>
            <span className="block truncate text-[0.65625rem] font-semibold text-[var(--color-ink)]">
              {slot.shop
                ? slot.shop.status === "approved"
                  ? slot.shop.name
                  : `${slot.shop.name} — ${t.admin.shopSuspended}`
                : slot.link_url || t.admin.noDestination}
            </span>
          </span>

          {slot.shop?.status === "approved" && (
            <Link
              href={`/boutique/${slot.shop.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex-none text-[0.65625rem] font-bold text-[var(--color-brand)]"
            >
              {t.admin.seeShop} ↗
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
