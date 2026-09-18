import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMallStatus, getSessionUser, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { SearchBar } from "@/components/shell/search-bar";
import { ProductCard } from "@/components/cards/product-card";
import { avecBlackFriday } from "@/lib/black-friday-server";
import { EmptyState } from "@/components/ui/primitives";
import { BellIcon, CartIcon } from "@/components/ui/icons";
import { CategoryFilters } from "./filters";

export const metadata: Metadata = {
  title: "Marketplace — les produits des boutiques de Gafsa",
  description:
    "Parcourez les produits des boutiques du mall de Gafsa. Retrait sur place en 30 minutes ou livraison à Gafsa.",
  alternates: { canonical: "/marketplace" },
};

export const dynamic = "force-dynamic";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { t, locale } = await getT();
  const params = await searchParams;
  const supabase = await createClient();

  const activeSlug = params.categorie ?? null;

  const [categories, counts, status, user] = await Promise.all([
    getCategories(),
    getTopBarCounts(),
    getMallStatus(),
    getSessionUser(),
  ]);

  const activeCategory = categories.find((c) => c.slug === activeSlug) ?? null;

  let query = supabase
    .from("products")
    .select(
      "id, name, price, compare_at_price, images, stock, shop:shops!inner(name, slug, status), category:categories(hue)",
    )
    .eq("is_online", true)
    .eq("is_draft", false)
    .eq("shops.status", "approved")
      .eq("shops.list_in_marketplace", true)
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

  const { data: lus } = await query;
  // Le prix Black Friday sur chaque carte, en une requête pour la grille.
  const products = await avecBlackFriday(lus ?? []);

  /*
    Les favoris de la personne, en une requête.

    Les vignettes portent un cœur : sans cette liste, il s'afficherait vide sur
    un article déjà en favori, et le premier toucher le retirerait au lieu de
    l'ajouter. Sans session, pas de cœur du tout.
  */
  let favorites: Set<string> | null = null;
  if (user) {
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
    favorites = new Set((data ?? []).map((row) => row.product_id));
  }

  return (
    <>
      {/*
        L'en-tête raconte l'état du mall avant de nommer l'écran.

        « Marketplace » seul n'apprend rien à quelqu'un qui vient d'ouvrir
        l'application. Le nombre de boutiques ouvertes, lui, dit s'il y a
        quelque chose à voir maintenant — c'est l'information qui décide de
        rester ou de revenir plus tard.
      */}
      <header className="flex flex-none items-center justify-between gap-3 px-[18px] pt-4 pb-1">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="text-[0.5625rem] font-bold tracking-[0.075rem] text-[var(--color-muted)]">
            {t.marketplace.eyebrow}
          </span>
          {/*
            « 0 boutiques ouvertes » n'apprend rien et décourage.

            Aucune boutique ouverte à cette heure ne veut pas dire qu'il n'y a
            rien à voir : le catalogue reste consultable, et la commande peut
            attendre l'ouverture. On annonce alors ce qui existe, et la pastille
            passe au gris — l'information reste vraie, le ton cesse d'être un
            constat d'échec.
          */}
          <span className="flex items-center gap-[6px]">
            <span
              aria-hidden
              className={`h-[6px] w-[6px] flex-none rounded-full ${
                status.anyOpen ? "bg-[var(--color-success)]" : "bg-[var(--color-faint)]"
              }`}
            />
            <span className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
              {status.anyOpen
                ? format(t.marketplace.openShops, { n: status.openCount })
                : format(t.marketplace.allShops, { n: status.totalCount })}
            </span>
          </span>
        </div>

        <Link
          href="/notifications"
          aria-label={t.nav.notifications}
          className="press relative flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[var(--color-ink)] shadow-[0_6px_16px_rgba(60,40,90,0.09)]"
        >
          <BellIcon size={17} />
          {counts.notifications > 0 && (
            <span className="absolute -top-[1px] -end-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] px-1 text-[0.53125rem] font-bold text-white">
              {counts.notifications > 99 ? "99+" : counts.notifications}
            </span>
          )}
        </Link>
      </header>

      <h1 className="flex-none px-[18px] pt-[10px] pb-2 text-[1.625rem] leading-[1.12] font-extrabold tracking-[-0.04375rem]">
        <span className="block text-[var(--color-ink)]">{t.marketplace.headingTop}</span>
        <span className="block font-normal text-[var(--color-muted)]">
          {t.marketplace.headingBottom}
        </span>
      </h1>

      <SearchBar placeholder={t.common.searchProduct} withMenu={false} />

      <CategoryFilters categories={categories} activeSlug={activeSlug} locale={locale} />

      <div className="no-sb flex-1 overflow-y-auto px-4 pt-[6px] pb-4">
        {products.length === 0 ? (
          <EmptyState title={t.marketplace.noResults} body={t.marketplace.noResultsBody} />
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                isFavorite={favorites ? favorites.has(product.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/*
        Le panier quitte la barre supérieure pour un bouton flottant.

        Dans une grille que l'on parcourt au pouce, il doit rester en bas de
        l'écran — et non à l'opposé, en haut à droite, là où le pouce n'atteint
        pas sans changer de prise.

        Positionné par rapport à la fenêtre et non au flux : en `sticky`, il
        n'apparaissait qu'une fois les quarante articles défilés. Son décalage
        vient du jeton partagé avec la barre d'onglets, si bien que les deux ne
        peuvent plus se recouvrir.

        Il n'apparaît qu'une fois le panier entamé. Vide, il ne mènerait qu'à un
        écran qui dit « votre panier est vide » — un bouton permanent pour une
        impasse — et il disputerait le bas de l'écran à l'invitation
        d'installation, qui s'affiche au même endroit.
      */}
      {counts.cart > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px]">
          <Link
            href="/panier"
            aria-label={t.cart.title}
            className="press pointer-events-auto absolute end-4 bottom-[var(--nav-space)] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-white shadow-[0_14px_28px_rgba(109,75,143,0.38)]"
          >
            <CartIcon size={21} />
            <span className="absolute -top-[2px] -end-[2px] flex h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-[var(--color-app)] bg-[var(--color-ink)] px-1 text-[0.59375rem] font-extrabold text-[var(--color-app)]">
              {counts.cart > 99 ? "99+" : counts.cart}
            </span>
          </Link>
        </div>
      )}
    </>
  );
}
