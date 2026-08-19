import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { SearchBar } from "@/components/shell/search-bar";
import { ProductCard } from "@/components/cards/product-card";
import { EmptyState } from "@/components/ui/primitives";
import { CategoryFilters } from "./filters";

export const metadata: Metadata = {
  title: "Marketplace — les produits des boutiques de Gafsa",
  description:
    "Parcourez les produits des boutiques du mall de Gafsa. Retrait sur place en 30 minutes ou livraison à Gafsa.",
  alternates: { canonical: "/marketplace" },
};

export const revalidate = 120;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { t, locale } = await getT();
  const params = await searchParams;
  const supabase = await createClient();

  const activeSlug = params.categorie ?? null;

  const [categories, counts] = await Promise.all([getCategories(), getTopBarCounts()]);

  const activeCategory = categories.find((c) => c.slug === activeSlug) ?? null;

  let query = supabase
    .from("products")
    .select(
      "id, name, price, compare_at_price, images, stock, shop:shops!inner(name, slug, status), category:categories(hue)",
    )
    .eq("is_online", true)
    .eq("is_draft", false)
    .eq("shops.status", "approved")
    .order("sold_count", { ascending: false })
    .limit(40);

  if (activeCategory) {
    // Une catégorie parente doit ramener aussi ses sous-catégories.
    const { data: children } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", activeCategory.id);

    const ids = [activeCategory.id, ...(children ?? []).map((c) => c.id)];
    query = query.in("category_id", ids);
  }

  const { data: products } = await query;

  return (
    <>
      <TopBar
        title={t.marketplace.title}
        icons={["notifications", "cart"]}
        counts={counts}
        className="pb-[6px]"
      />
      <SearchBar placeholder={t.common.searchProduct} withVoice={false} withMenu={false} />

      <CategoryFilters categories={categories} activeSlug={activeSlug} locale={locale} />
      <div className="no-sb flex-1 overflow-y-auto px-4 pt-[6px] pb-4">
        {(products ?? []).length === 0 ? (
          <EmptyState title={t.marketplace.noResults} body={t.marketplace.noResultsBody} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products!.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
