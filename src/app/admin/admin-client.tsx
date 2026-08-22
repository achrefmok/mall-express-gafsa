"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { approveShop, deactivateCityAlert, publishCityAlert, rejectShop } from "@/app/actions/admin";
import { moderateDeal } from "@/app/actions/deals";
import { cx } from "@/lib/format";
import { Button, Card, Divider, KeyValueRow, Placeholder, SectionTitle, fieldClass } from "@/components/ui/primitives";

/* ─── Boutique en attente ──────────────────────────────────────────────── */

export function PendingShopRow({
  shop,
}: {
  shop: {
    id: string;
    name: string;
    slug: string;
    monogram: string;
    hue: number;
    submittedAgo: string;
    productCount: number;
    missingDocument: string | null;
  };
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [asking, setAsking] = useState(false);
  const [document, setDocument] = useState(shop.missingDocument ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveShop(shop.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function onAskDocument() {
    setError(null);
    startTransition(async () => {
      const result = await rejectShop(shop.id, reason || "Dossier à compléter", document);
      if (result.ok) {
        setAsking(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-2 p-[11px]">
      <div className="flex items-center gap-[10px]">
        <span
          className="cat-surface cat-ink flex h-8 w-8 flex-none items-center justify-center rounded-full text-[0.6875rem] font-bold"
          style={{ "--hue": shop.hue } as React.CSSProperties}
        >
          {shop.monogram}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">{shop.name}</p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {format(t.admin.submittedAgo, { when: shop.submittedAgo, n: shop.productCount })}
          </p>
          {shop.missingDocument && (
            <p className="text-[0.625rem] font-semibold text-[var(--color-live)]">
              {format(t.vendor.missingDoc, { doc: shop.missingDocument })}
            </p>
          )}
        </div>

        <div className="flex flex-none gap-[6px]">
          <button
            type="button"
            onClick={onApprove}
            disabled={pending}
            className="rounded-[12px] bg-[var(--color-brand-fill)] px-[10px] py-[6px] text-[0.625rem] font-bold text-white disabled:opacity-50"
          >
            {t.admin.approve}
          </button>
          <button
            type="button"
            onClick={() => setAsking((v) => !v)}
            className="rounded-[12px] border border-[var(--color-outline)] px-[9px] py-[6px] text-[0.625rem] font-bold text-[var(--color-muted)]"
          >
            {shop.missingDocument ? t.admin.remind : t.common.see}
          </button>
        </div>
      </div>

      {asking && (
        <div className="flex animate-slide-up flex-col gap-2 rounded-[14px] bg-[var(--color-brand-tint)] p-2">
          <input
            value={document}
            onChange={(event) => setDocument(event.target.value)}
            placeholder={t.admin.askMissingDoc}
            aria-label={t.admin.askMissingDoc}
            className="rounded-[10px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-2 py-[6px] text-[0.6875rem] outline-none"
          />
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t.admin.rejectReason}
            aria-label={t.admin.rejectReason}
            className="rounded-[10px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-2 py-[6px] text-[0.6875rem] outline-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onAskDocument} disabled={pending} className="flex-1">
              {t.admin.remind}
            </Button>
            <Link
              href={`/boutique/${shop.slug}`}
              className="flex-1 rounded-[16px] border border-[var(--color-outline)] py-[7px] text-center text-[0.65625rem] font-semibold text-[var(--color-muted)]"
            >
              {t.common.see}
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}
    </Card>
  );
}

/* ─── Signalement ──────────────────────────────────────────────────────── */

export function ReportRow({
  report,
}: {
  report: { targetType: string; targetId: string; count: number; title: string; subtitle: string };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(decision: "remove" | "keep") {
    startTransition(async () => {
      if (report.targetType === "deal") {
        await moderateDeal(report.targetId, decision);
      }
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-none items-center gap-[10px] p-[11px]">
      <Placeholder className="h-9 w-9 flex-none" rounded="thumb" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">{report.title}</p>
        <p className="truncate text-[0.625rem] text-[var(--color-muted)]">{report.subtitle}</p>
      </div>

      <div className="flex flex-none gap-[6px]">
        <button
          type="button"
          onClick={() => decide("remove")}
          disabled={pending}
          className="rounded-[12px] bg-[var(--color-live-fill)] px-[10px] py-[6px] text-[0.625rem] font-bold text-white disabled:opacity-50"
        >
          {t.admin.remove}
        </button>
        <button
          type="button"
          onClick={() => decide("keep")}
          disabled={pending}
          className="rounded-[12px] border border-[var(--color-outline)] px-[9px] py-[6px] text-[0.625rem] font-bold text-[var(--color-muted)] disabled:opacity-50"
        >
          {t.admin.keep}
        </button>
      </div>
    </Card>
  );
}

/* ─── Pilotage de la plateforme ────────────────────────────────────────── */

/**
 * Partage le lien d'inscription vendeur : feuille de partage du système quand
 * elle existe — c'est-à-dire WhatsApp sur les téléphones de Gafsa — et copie
 * dans le presse-papiers sinon.
 */
function InviteShopButton() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = `${window.location.origin}/inscription?role=vendeur`;

    if (navigator.share) {
      try {
        await navigator.share({ title: t.account.becomeVendor, url });
        return;
      } catch {
        // Partage annulé : on retombe sur la copie.
      }
    }

    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  }

  return (
    <button type="button" onClick={onShare} className="font-bold text-[var(--color-brand)]">
      {copied ? t.admin.linkCopied : t.admin.shareLink}
    </button>
  );
}

export function SteeringPanel({
  sponsoredCount,
  categoriesCount,
  activeAlerts,
}: {
  sponsoredCount: number;
  categoriesCount: number;
  activeAlerts: Array<{ id: string; title: string; severity: string }>;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("warning");
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishCityAlert({
        title,
        titleAr,
        body,
        severity,
        days: Number.parseInt(days, 10) || 7,
      });

      if (result.ok) {
        setComposing(false);
        setTitle("");
        setTitleAr("");
        setBody("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const field =
    fieldClass({ size: "xs", solid: true });

  return (
    <section className="flex flex-none flex-col gap-2">
      <SectionTitle>{t.admin.steering}</SectionTitle>

      <Card className="flex flex-col gap-[10px] p-3">
        <KeyValueRow label={t.admin.featureShop}>
          <Link href="/admin/boutiques" className="font-bold text-[var(--color-brand)]">
            {t.admin.choose}
          </Link>
        </KeyValueRow>

        <Divider />

        <KeyValueRow label={t.admin.sponsoredSlots}>
          <Link href="/admin/sponsors" className="font-bold text-[var(--color-brand)]">
            {format(t.admin.activeCount, { n: sponsoredCount })}
          </Link>
        </KeyValueRow>

        <Divider />

        {/*
          Le catalogue ne se remplit pas tout seul : la plateforme démarre en
          allant chercher les commerçants. Le lien porte déjà `role=vendeur`,
          l'inscription s'ouvre donc directement sur le formulaire boutique.
        */}
        <KeyValueRow label={t.admin.inviteShop}>
          <InviteShopButton />
        </KeyValueRow>

        <Divider />

        <KeyValueRow label={t.admin.publishAlert}>
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="font-bold text-[var(--color-brand)]"
          >
            {t.admin.write}
          </button>
        </KeyValueRow>

        {composing && (
          <div className="flex animate-slide-up flex-col gap-2 rounded-[14px] bg-[var(--color-brand-tint)] p-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'alerte"
              aria-label="Titre de l'alerte"
              className={field}
            />
            <input
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="العنوان بالعربية"
              aria-label="العنوان بالعربية"
              dir="rtl"
              lang="ar"
              className={field}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Message"
              aria-label="Message"
              className={cx(field, "resize-none")}
            />

            <div className="flex gap-2">
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                aria-label="Gravité"
                className={cx(field, "flex-1")}
              >
                <option value="info">Info</option>
                <option value="warning">Vigilance</option>
                <option value="critical">Critique</option>
              </select>
              <input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                inputMode="numeric"
                aria-label="Durée en jours"
                className={cx(field, "w-20")}
              />
            </div>

            {error && (
              <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
                {error}
              </p>
            )}

            <Button size="sm" onClick={onPublish} disabled={pending || !title.trim()} block>
              {pending ? t.common.loading : t.common.publish}
            </Button>
          </div>
        )}

        {activeAlerts.length > 0 && (
          <div className="flex flex-col gap-1">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 text-[0.65625rem]">
                <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{alert.title}</span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await deactivateCityAlert(alert.id);
                      router.refresh();
                    })
                  }
                  className="flex-none font-bold text-[var(--color-live)]"
                >
                  {t.admin.remove}
                </button>
              </div>
            ))}
          </div>
        )}

        <Divider />

        <KeyValueRow label={t.admin.manageCategories}>
          <Link href="/admin/categories" className="font-bold text-[var(--color-brand)]">
            {format(t.admin.categoriesCount, { n: categoriesCount })}
          </Link>
        </KeyValueRow>
      </Card>
    </section>
  );
}
