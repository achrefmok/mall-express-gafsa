"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/** Les trois clés de specs attendues côté vendeur — voir le Lot 10. */
const CLES_SPECS = ["stockage", "ecran", "batterie"] as const;

/**
 * « Fiche technique » — Électronique.
 *
 * Les mini-stats viennent de `product_attributes` : un produit qui n'en a
 * aucune (le cas de toute boutique aujourd'hui, avant le formulaire
 * vendeur du Lot 10) reste une carte simple, sans case vide ni tiret. Le
 * comparateur fonctionne quand même — comparer deux fiches sans specs
 * reste utile pour les photos et les prix.
 */
export function ElectroniqueLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const { t } = useI18n();
  const [comparaison, setComparaison] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState(false);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const toggleComparaison = (id: string) =>
    setComparaison((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));

  const produitsComparés = visible.filter((p) => comparaison.includes(p.id));

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="grid grid-cols-2 gap-x-[10px] gap-y-[18px]">
        {visible.map((product) => {
          const specs = CLES_SPECS.map((cle) => product.attributs?.[cle]).filter(Boolean) as string[];
          const enComparaison = comparaison.includes(product.id);
          return (
            <div key={product.id} className="flex flex-col gap-[6px]">
              <ProductCard
                product={{ ...product, shop: null }}
                locale={locale}
                showShop={false}
                imageHeight={118}
              />
              {specs.length > 0 && (
                <div className="flex gap-[4px] px-[4px]">
                  {specs.map((v, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-[10px] bg-[var(--theme-accent-doux)] px-[6px] py-[4px] text-center text-[0.5625rem] font-bold text-[var(--theme-accent-fort)]"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => toggleComparaison(product.id)}
                className="mx-[4px] rounded-[10px] px-[8px] py-[6px] text-[0.625rem] font-bold"
                style={{
                  background: enComparaison ? "var(--theme-accent)" : "transparent",
                  color: enComparaison ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                  border: enComparaison ? "none" : "1px solid var(--theme-accent)",
                }}
              >
                {enComparaison ? "✓ " : "+ "}
                {t.product.compare}
              </button>
            </div>
          );
        })}
      </div>

      {comparaison.length > 0 && !ouvert && (
        <div className="fixed right-4 bottom-20 left-4 z-30 flex items-center justify-between rounded-[24px] bg-[var(--theme-accent)] px-[16px] py-[10px] text-[var(--theme-accent-texte)] shadow-[0_6px_18px_rgba(0,0,0,0.3)]">
          <span className="text-[0.75rem] font-bold">
            {comparaison.length} {t.product.selected}
          </span>
          <button type="button" onClick={() => setOuvert(true)} className="rounded-[14px] bg-white px-[14px] py-[7px] text-[0.6875rem] font-bold text-[var(--theme-accent)]">
            {t.product.compare}
          </button>
        </div>
      )}

      {ouvert && (
        <div className="fixed inset-0 z-40 flex items-end bg-[rgba(36,31,46,0.45)]" onClick={() => setOuvert(false)}>
          <div
            className="flex w-full flex-col gap-[12px] rounded-t-[28px] bg-[var(--color-app)] p-[16px_16px_28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[1rem] font-bold">{t.product.compare}</span>
              <button type="button" onClick={() => setOuvert(false)} className="text-[0.75rem] font-bold text-[var(--theme-accent-fort)]">
                {t.common.close}
              </button>
            </div>
            <div className="overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)]">
              <div
                className="grid gap-[4px] bg-[var(--theme-accent-doux)] p-[10px] text-[0.625rem] text-[var(--theme-muted)]"
                style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
              >
                <span />
                {produitsComparés.map((p) => (
                  <span key={p.id} className="truncate font-bold">
                    {p.name}
                  </span>
                ))}
              </div>
              {CLES_SPECS.map((cle) => (
                <div
                  key={cle}
                  className="grid gap-[4px] border-t border-[var(--color-hairline)] p-[10px] text-[0.6875rem]"
                  style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
                >
                  <span className="text-[var(--color-muted)]">{cle}</span>
                  {produitsComparés.map((p) => (
                    <span key={p.id}>{p.attributs?.[cle] ?? "—"}</span>
                  ))}
                </div>
              ))}
              <div
                className="grid gap-[4px] border-t border-[var(--color-hairline)] p-[10px] text-[0.6875rem] font-bold"
                style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
              >
                <span className="font-normal text-[var(--color-muted)]">{t.product.price}</span>
                {produitsComparés.map((p) => (
                  <span key={p.id} style={{ color: "var(--theme-accent-fort)" }}>
                    {formatPrice(p.price, locale)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
