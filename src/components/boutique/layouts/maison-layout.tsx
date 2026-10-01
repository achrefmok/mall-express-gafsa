"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/**
 * « Par pièce » — Maison.
 *
 * Les chips de pièce viennent de l'attribut `piece` (`product_attributes`),
 * jamais d'une liste figée : seules les valeurs réellement déclarées par
 * cette boutique apparaissent. Aucun produit n'a encore de `piece` — grille
 * simple, sans rail vide.
 */
export function MaisonLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const pieces = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const p of visible) {
      const piece = p.attributs?.piece;
      if (!piece) continue;
      comptes.set(piece, (comptes.get(piece) ?? 0) + 1);
    }
    return [...comptes.entries()];
  }, [visible]);

  const [pieceActive, setPieceActive] = useState<string | null>(null);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const produits = pieceActive ? visible.filter((p) => p.attributs?.piece === pieceActive) : visible;

  return (
    <div className="flex flex-col gap-[14px]">
      {pieces.length > 0 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          {pieces.map(([piece, count]) => {
            const on = piece === pieceActive;
            return (
              <button
                key={piece}
                type="button"
                onClick={() => setPieceActive(on ? null : piece)}
                className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
                style={{
                  background: on ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                }}
              >
                {piece} · {count}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {produits.map((p) => {
          const legende = [p.attributs?.dimensions, p.attributs?.materiau].filter(Boolean).join(" · ");
          return (
            <div key={p.id} className="flex flex-col gap-[2px]">
              <ProductCard product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
              {legende && (
                <p className="px-[4px] text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">{legende}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
