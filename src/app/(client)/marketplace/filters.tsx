"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Card, Chip, Rail, Switch } from "@/components/ui/primitives";
import type { AppLocale, Category } from "@/types/database";

/** Chips de catégorie, chacune dans sa propre nuance. */
export function CategoryFilters({
  categories,
  activeSlug,
  locale,
}: {
  categories: Category[];
  activeSlug: string | null;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const select = useCallback(
    (slug: string | null) => {
      const next = new URLSearchParams(params);
      if (slug) next.set("categorie", slug);
      else next.delete("categorie");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <Rail className="flex-none px-4 py-[10px]" gap={8}>
      <Chip active={!activeSlug} onClick={() => select(null)}>
        {t.common.all}
      </Chip>
      {categories.map((category) => (
        <Chip
          key={category.id}
          tone="category"
          hue={category.hue}
          active={activeSlug === category.slug}
          onClick={() => select(category.slug)}
        >
          {locale === "ar" ? category.name_ar : category.name_fr}
        </Chip>
      ))}
    </Rail>
  );
}

/** Encart « Retrait au mall en 30 min ». */
export function PickupToggle({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function toggle(next: boolean) {
    const search = new URLSearchParams(params);
    if (next) search.delete("retrait");
    else search.set("retrait", "0");
    router.replace(`${pathname}?${search}`, { scroll: false });
  }

  return (
    <Card className="mx-4 mb-[10px] flex flex-none items-center gap-[10px] p-[10px_12px]">
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold text-[var(--color-ink)]">{t.marketplace.pickupTitle}</p>
        <p className="text-[10.5px] text-[var(--color-muted)]">{t.marketplace.pickupBody}</p>
      </div>
      <Switch checked={enabled} onChange={toggle} label={t.marketplace.pickupTitle} />
    </Card>
  );
}
