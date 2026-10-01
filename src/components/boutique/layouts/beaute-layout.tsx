"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

const ONGLETS = [
  { slug: "beaute-maquillage", labelFr: "Maquillage", labelAr: "مكياج" },
  { slug: "beaute-parfums", labelFr: "Parfums", labelAr: "عطور" },
  { slug: "beaute-soin", labelFr: "Soin", labelAr: "العناية" },
] as const;

/**
 * « Studio premium » — Beauté, trois onglets internes.
 *
 * Les onglets viennent des sous-catégories `beaute-maquillage`/
 * `beaute-parfums`/`beaute-soin` (migration dédiée) — une vraie donnée que
 * le vendeur choisit en rangeant son produit, pas un attribut séparé.
 * Aucune boutique n'a encore rangé ses produits ainsi (pas plus de deux
 * sous-catégories réellement utilisées) : la grille simple reste le repli,
 * sans onglet vide.
 *
 * Dans l'onglet Parfums, la pyramide (tête/cœur/fond) ne s'affiche que si
 * le produit porte ces attributs (`product_attributes`, Lot 10 côté
 * vendeur) — sinon la carte reste une carte simple.
 */
export function BeauteLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const { t } = useI18n();

  const groupes = useMemo(() => {
    const parSlug = new Map<string, ProduitBoutique[]>();
    for (const o of ONGLETS) parSlug.set(o.slug, []);
    for (const p of visible) {
      const slug = p.category?.slug;
      if (slug && parSlug.has(slug)) parSlug.get(slug)!.push(p);
    }
    return parSlug;
  }, [visible]);

  const ongletsUtiles = ONGLETS.filter((o) => (groupes.get(o.slug) ?? []).length > 0);
  const [actif, setActif] = useState<string | null>(null);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  // Moins de deux onglets réellement peuplés : pas de segmentation utile.
  if (ongletsUtiles.length < 2) {
    return (
      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {visible.map((p) => (
          <ProductCard key={p.id} product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
        ))}
      </div>
    );
  }

  const slugActif = actif ?? ongletsUtiles[0].slug;
  const produitsActifs = groupes.get(slugActif) ?? [];
  const estParfums = slugActif === "beaute-parfums";

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex gap-[4px] rounded-[18px] bg-[var(--theme-accent-doux)] p-[4px]">
        {ongletsUtiles.map((o) => {
          const on = o.slug === slugActif;
          return (
            <button
              key={o.slug}
              type="button"
              onClick={() => setActif(o.slug)}
              className="flex-1 rounded-[14px] py-[8px] text-center text-[0.71875rem] font-bold whitespace-nowrap"
              style={{
                background: on ? "var(--theme-surface,#fff)" : "transparent",
                color: on ? "var(--theme-accent-fort)" : "var(--theme-muted)",
              }}
            >
              {locale === "ar" ? o.labelAr : o.labelFr}
            </button>
          );
        })}
      </div>

      {produitsActifs.length === 0 ? (
        <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
          {produitsActifs.map((p) => {
            const notes = estParfums
              ? ["note_tete", "note_coeur", "note_fond"].map((c) => p.attributs?.[c]).filter(Boolean)
              : [];
            return (
              <div key={p.id} className="flex flex-col gap-[4px]">
                <ProductCard product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
                {notes.length > 0 && (
                  <p className="px-[4px] text-[0.625rem] leading-[1.4] text-[var(--theme-muted,var(--color-muted))]">
                    {notes.join(" · ")}
                  </p>
                )}
                {estParfums && p.attributs?.tenue_heures && (
                  <p className="px-[4px] text-[0.625rem] font-bold text-[var(--theme-accent-fort)]">
                    {t.product.wear} {p.attributs.tenue_heures}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
