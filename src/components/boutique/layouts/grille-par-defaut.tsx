import { EmptyState } from "@/components/ui/primitives";
import { ProductCard, type ProductCardData } from "@/components/cards/product-card";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";

/**
 * La grille d'origine, extraite de `BoutiqueContenu` sans aucun changement —
 * c'est le repli de `theme.productLayout` pour toute famille qui n'a pas
 * encore sa propre mise en page (toutes, pour l'instant : voir le dispatch
 * dans `boutique-contenu.tsx`, qui l'appelle inconditionnellement tant que
 * les mises en page par métier ne sont pas construites).
 */
export function GrilleParDefaut({
  visible,
  locale,
  theme,
}: {
  visible: ProductCardData[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-[10px] gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((product) => (
        <ProductCard
          key={product.id}
          product={{ ...product, shop: null }}
          locale={locale}
          showShop={false}
          imageHeight={118}
        />
      ))}
    </div>
  );
}
