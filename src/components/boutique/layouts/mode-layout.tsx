"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/**
 * « Vitrine éditoriale » — Mode.
 *
 * Le rayon de types (femme/homme/enfant/chaussures/accessoires) vient de la
 * vraie sous-catégorie de chaque produit, pas d'une donnée inventée : ces
 * cinq familles sont déjà sœurs sous « mode » dans `categories` (voir
 * `THEME_PAR_CATEGORIE`). Une boutique qui n'a encore rangé aucun produit
 * dans une sous-catégorie précise (`category` absent) n'affiche simplement
 * pas de rayon — la recherche et la grille fonctionnent quand même.
 *
 * Le lookbook à repères du prototype de design n'est pas construit ici :
 * il dépendrait d'un attribut qui n'existe pas encore (`lookbook_hotspots`,
 * vendeur, lot à venir). Tant qu'aucun produit ne le porte, il n'y a rien à
 * afficher — pas de section vide à sa place.
 */
export function ModeLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);

  const types = useMemo(() => {
    const comptes = new Map<string, { label: string; count: number }>();
    for (const p of visible) {
      const slug = p.category?.slug;
      if (!slug) continue;
      const label = (locale === "ar" ? p.category?.name_ar : p.category?.name_fr) ?? slug;
      const entry = comptes.get(slug);
      if (entry) entry.count += 1;
      else comptes.set(slug, { label, count: 1 });
    }
    return [...comptes.entries()].map(([slug, v]) => ({ slug, ...v }));
  }, [visible, locale]);

  const normalise = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filtres = useMemo(() => {
    const q = normalise(query.trim());
    return visible.filter((p) => {
      if (type && p.category?.slug !== type) return false;
      if (q && !normalise(p.name).includes(q)) return false;
      return true;
    });
  }, [visible, type, query]);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[8px] rounded-[16px] bg-[var(--theme-surface,var(--color-surface-solid))] px-[12px] shadow-[0_4px_14px_rgba(60,40,90,0.07)]">
        <span className="text-[0.875rem] text-[var(--theme-muted,var(--color-faint))]" aria-hidden>
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.common.searchProduct}
          className="min-w-0 flex-1 border-0 bg-transparent py-[12px] text-[0.75rem] text-[var(--theme-texte,var(--color-ink))] outline-none"
        />
      </div>

      {types.length > 1 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          <button
            type="button"
            onClick={() => setType(null)}
            className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
            style={{
              background: type === null ? "var(--theme-accent)" : "var(--theme-accent-doux)",
              color: type === null ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
            }}
          >
            {t.common.all} · {visible.length}
          </button>
          {types.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => setType(entry.slug === type ? null : entry.slug)}
              className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
              style={{
                background: entry.slug === type ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                color: entry.slug === type ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
              }}
            >
              {entry.label} · {entry.count}
            </button>
          ))}
        </div>
      )}

      {filtres.length === 0 ? (
        <EmptyState title={format(t.search.noResults, { q: query.trim() })} />
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
          {filtres.map((product, i) => (
            <div key={product.id} className={i === 0 && filtres.length > 2 ? "col-span-2" : undefined}>
              <ProductCard
                product={{ ...product, shop: null }}
                locale={locale}
                showShop={false}
                imageHeight={i === 0 && filtres.length > 2 ? 220 : 118}
              />
              {product.sizes && product.sizes.length > 0 && (
                <p className="mt-[2px] px-[4px] text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
                  {product.sizes.join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
