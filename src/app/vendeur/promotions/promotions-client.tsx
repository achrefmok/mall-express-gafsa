"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { upsertPromotion } from "@/app/actions/vendor";
import { cx, formatDateTime } from "@/lib/format";
import { Button, Card, Divider, EmptyState, KeyValueRow, Switch, fieldClass } from "@/components/ui/primitives";
import type { AppLocale, Promotion } from "@/types/database";

const FIELD =
  fieldClass({ size: "sm", solid: true });
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

/** Échéance par défaut : dans deux semaines. */
function inTwoWeeks(): string {
  const date = new Date(Date.now() + 14 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T20:00`;
}

export function PromotionsManager({
  promotions,
  locale,
}: {
  promotions: Promotion[];
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [percent, setPercent] = useState("30");
  const [endsAt, setEndsAt] = useState(inTwoWeeks);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate() {
    setError(null);

    startTransition(async () => {
      const result = await upsertPromotion({
        title,
        titleAr,
        percentOff: Number.parseInt(percent, 10) || 0,
        endsAt: new Date(endsAt).toISOString(),
      });

      if (result.ok) {
        setTitle("");
        setTitleAr("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      {promotions.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          body="Une promotion s'affiche en bandeau sur votre fiche boutique."
        />
      ) : (
        promotions.map((promotion) => (
          <PromotionRow key={promotion.id} promotion={promotion} locale={locale} />
        ))
      )}

      {/* ─── Création ────────────────────────────────────────────────── */}
      <Card className="flex flex-none flex-col gap-2 p-3">
        <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">{t.common.add}</p>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Titre</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Promotion Automne"
            className={cx(FIELD, "placeholder:text-[var(--color-faint)]")}
          />
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

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className={LABEL}>Remise (%)</span>
            <input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              inputMode="numeric"
              className={FIELD}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className={LABEL}>Jusqu&apos;au</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <Button size="sm" block onClick={onCreate} disabled={pending || !title.trim()}>
          {pending ? t.common.loading : t.common.add}
        </Button>
      </Card>
    </div>
  );
}

function PromotionRow({ promotion, locale }: { promotion: Promotion; locale: AppLocale }) {
  const { t } = useI18n();
  const router = useRouter();

  const [active, setActive] = useState(promotion.is_active);
  const [pending, startTransition] = useTransition();

  const expired = new Date(promotion.ends_at).getTime() <= Date.now();

  return (
    <Card className={cx("flex flex-none flex-col gap-2 p-3", expired && "opacity-60")}>
      <div className="flex items-center gap-[10px]">
        <span className="flex-none rounded-[14px] bg-[var(--color-live-fill)] px-[9px] py-[6px] text-[0.6875rem] font-bold text-white">
          −{promotion.percent_off}%
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
            {promotion.title}
          </p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {expired ? t.deals.expired : `${t.deals.validUntil} ${formatDateTime(promotion.ends_at, locale)}`}
          </p>
        </div>
      </div>

      <Divider />

      <KeyValueRow label={<span className="text-[var(--color-muted)]">Active</span>}>
        <Switch
          checked={active}
          disabled={pending || expired}
          label={promotion.title}
          onChange={(next) => {
            setActive(next);
            startTransition(async () => {
              const result = await upsertPromotion({
                id: promotion.id,
                title: promotion.title,
                titleAr: promotion.title_ar ?? undefined,
                percentOff: promotion.percent_off,
                endsAt: promotion.ends_at,
                isActive: next,
              });
              if (result.ok) router.refresh();
              else setActive(!next);
            });
          }}
        />
      </KeyValueRow>
    </Card>
  );
}
