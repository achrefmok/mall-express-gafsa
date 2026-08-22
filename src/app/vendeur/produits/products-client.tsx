"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { adjustStock, deleteProduct, setProductOnline } from "@/app/actions/vendor";
import { cx, formatPrice } from "@/lib/format";
import { Card, Chip, Placeholder, Rail, Switch } from "@/components/ui/primitives";
import { MinusIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import type { AppLocale } from "@/types/database";

export function ProductFilters({
  active,
  totalCount,
  lowStockCount,
  initialQuery,
}: {
  active: string;
  totalCount: number;
  lowStockCount: number;
  initialQuery: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = useState(initialQuery);

  // Recherche différée : on ne réécrit pas l'URL à chaque frappe.
  useEffect(() => {
    if (query === initialQuery) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`${pathname}?${next}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, initialQuery, params, pathname, router]);

  function select(key: string) {
    const next = new URLSearchParams(params);
    if (key === "all") next.delete("filtre");
    else next.set("filtre", key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <>
      <div className="flex-none border-b border-[var(--color-hairline)] px-4 pt-[6px] pb-3">
        <div className="flex items-center gap-2 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] px-[14px] py-[9px] shadow-[var(--shadow-search)]">
          <SearchIcon size={14} className="flex-none text-[var(--color-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.vendor.searchMyProducts}
            aria-label={t.vendor.searchMyProducts}
            className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
          />
        </div>
      </div>

      <Rail className="flex-none px-4 py-[10px]" gap={8}>
        <Chip active={active === "all"} onClick={() => select("all")}>
          {format(t.vendor.tabsAll, { n: totalCount })}
        </Chip>
        <Chip active={active === "online"} onClick={() => select("online")}>
          {t.vendor.tabsOnline}
        </Chip>
        <Chip
          tone="live"
          active={active === "low-stock"}
          onClick={() => select("low-stock")}
        >
          {format(t.vendor.tabsLowStock, { n: lowStockCount })}
        </Chip>
        <Chip active={active === "drafts"} onClick={() => select("drafts")}>
          {t.vendor.tabsDrafts}
        </Chip>
      </Rail>
    </>
  );
}

export function ProductRow({
  product,
  locale,
}: {
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    low_stock_threshold: number;
    images: string[];
    is_online: boolean;
    is_draft: boolean;
  };
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [online, setOnline] = useState(product.is_online);
  const [stock, setStock] = useState(product.stock);
  const [restockBy, setRestockBy] = useState(10);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const isLow = stock <= product.low_stock_threshold;

  function onToggleOnline(next: boolean) {
    setOnline(next);
    startTransition(async () => {
      const result = await setProductOnline(product.id, next);
      if (!result.ok) setOnline(!next);
    });
  }

  function onRestock() {
    startTransition(async () => {
      const result = await adjustStock(product.id, restockBy);
      if (result.ok) setStock(result.data.stock);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="flex flex-none items-center gap-[10px] p-[10px]">
      {product.images?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniature fixe 52px
        <img
          src={product.images[0]}
          alt=""
          className="h-[52px] w-[52px] flex-none rounded-[14px] object-cover"
        />
      ) : (
        <Placeholder className="h-[52px] w-[52px] flex-none" rounded="thumb" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
          {product.name}
          {product.is_draft && (
            <span className="ms-2 text-[0.59375rem] font-normal text-[var(--color-faint)]">
              {t.vendor.tabsDrafts}
            </span>
          )}
        </p>
        <p className="text-[0.6875rem] font-bold text-[var(--color-brand)]">
          {formatPrice(product.price, locale)}
        </p>
        <p
          className={cx(
            "text-[0.625rem]",
            isLow ? "font-semibold text-[var(--color-live)]" : "text-[var(--color-muted)]",
          )}
        >
          {format(isLow ? t.vendor.stockLow : t.vendor.stock, { n: stock })}
        </p>

        {/* Réappro rapide, uniquement là où c'est utile. */}
        {isLow && (
          <div className="mt-[5px] flex items-center gap-[6px]">
            <span className="text-[0.59375rem] text-[var(--color-muted)]">{t.vendor.quickRestock}</span>
            <span className="flex items-center gap-2 rounded-[10px] bg-[var(--color-brand-tint)] px-2 py-[2px]">
              <button
                type="button"
                onClick={() => setRestockBy((n) => Math.max(1, n - 5))}
                aria-label="−"
                className="p-1 text-[var(--color-brand)]"
              >
                <MinusIcon size={11} />
              </button>
              <button
                type="button"
                onClick={onRestock}
                disabled={pending}
                className="text-[0.65625rem] font-bold tabular-nums text-[var(--color-ink)]"
              >
                +{restockBy}
              </button>
              <button
                type="button"
                onClick={() => setRestockBy((n) => n + 5)}
                aria-label="+"
                className="p-1 text-[var(--color-brand)]"
              >
                <PlusIcon size={11} />
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-none flex-col items-end gap-[6px]">
        <Switch checked={online} onChange={onToggleOnline} label={t.vendor.tabsOnline} disabled={pending} />

        {confirming ? (
          <span className="flex items-center gap-2 text-[0.625rem]">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="font-bold text-[var(--color-live)]"
            >
              {t.common.confirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[var(--color-muted)]"
            >
              {t.common.cancel}
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[0.625rem] text-[var(--color-muted)]">
            <Link href={`/vendeur/produits/${product.id}`} className="hover:text-[var(--color-brand)]">
              {t.common.edit}
            </Link>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => setConfirming(true)}>
              {t.common.delete}
            </button>
          </span>
        )}
      </div>
    </Card>
  );
}
