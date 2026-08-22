"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Chip, Rail } from "@/components/ui/primitives";
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
      <Chip size="md" tone="surface" active={!activeSlug} onClick={() => select(null)}>
        {t.common.all}
      </Chip>
      {categories.map((category) => (
        <Chip
          key={category.id}
          size="md"
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
