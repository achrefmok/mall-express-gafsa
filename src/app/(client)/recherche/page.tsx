import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { monogram } from "@/lib/format";
import { SearchBar } from "@/components/shell/search-bar";
import { ProductCard } from "@/components/cards/product-card";
import { Avatar, EmptyState, ButtonLink, Rail, SectionTitle } from "@/components/ui/primitives";
import { BackButton } from "@/components/shell/back";

export const metadata: Metadata = {
  title: "Recherche",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Les résultats d'une recherche, en grille.
 *
 * La recherche n'existait que sous forme de liste déroulante sous le champ :
 * huit lignes, puis plus rien. Un client qui cherchait « t-shirt » ne pouvait
 * ni voir les prix côte à côte, ni comparer, ni continuer au-delà des huit
 * premiers — il n'y avait pas de page où atterrir.
 *
 * La grille reprend la vignette de la marketplace : même carte, même geste,
 * même bouton d'achat. Rien de nouveau à apprendre entre parcourir et chercher.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { t, locale } = await getT();
  const query = (q ?? "").trim();

  const supabase = await createClient();
  const [counts, user] = await Promise.all([getTopBarCounts(), getSessionUser()]);

  /*
    Deux recherches en parallèle : les articles et les boutiques.

    Chercher « zara » doit mener à la boutique, chercher « t-shirt » aux
    articles. Deviner l'intention à partir du seul mot saisi se trompe une fois
    sur deux ; montrer les deux, avec les boutiques en tête sur un rail court,
    ne se trompe jamais.

    `%` échappé : un client qui tape « 50% » cherche une remise, pas un joker
    qui ramènerait tout le catalogue.
  */
  const motif = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const [products, shops, favorites] = await Promise.all([
    query.length >= 2
      ? supabase
          .from("products")
          .select(
            "id, name, price, compare_at_price, images, colors, variant_images, stock, shop:shops!inner(name, slug, status), category:categories(hue)",
          )
          .eq("is_online", true)
          .eq("is_draft", false)
          .eq("shops.status", "approved")
          .or(`name.ilike.${motif},description.ilike.${motif}`)
          .order("sold_count", { ascending: false })
          .limit(40)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),

    query.length >= 2
      ? supabase
          .from("shops")
          .select("id, name, slug, logo_url")
          .eq("status", "approved")
          .ilike("name", motif)
          .order("followers_count", { ascending: false })
          .limit(8)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),

    user
      ? supabase
          .from("favorites")
          .select("product_id")
          .eq("user_id", user.id)
          .then(({ data }) => new Set((data ?? []).map((r) => r.product_id)))
      : Promise.resolve(null),
  ]);

  const vide = query.length >= 2 && products.length === 0 && shops.length === 0;

  return (
    <>
      <header className="flex flex-none items-center gap-2 px-4 pt-4 pb-1">
        <BackButton
          fallback="/marketplace"
          className="press -ms-1 flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--color-ink)]"
        />
        <h1 className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold text-[var(--color-ink)]">
          {query ? `« ${query} »` : t.common.search}
        </h1>
      </header>

      <SearchBar placeholder={t.common.searchProduct} withMenu={false} initialQuery={query} />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
        {query.length < 2 ? (
          <EmptyState title={t.common.search} body={t.search.hint} />
        ) : vide ? (
          <EmptyState
            title={format(t.search.noResults, { q: query })}
            body={t.search.noResultsBody}
            action={
              <ButtonLink href="/marketplace" size="sm" className="mt-1">
                {t.nav.marketplace}
              </ButtonLink>
            }
          />
        ) : (
          <>
            {shops.length > 0 && (
              <section className="flex flex-none flex-col gap-2">
                <SectionTitle>{t.search.shops}</SectionTitle>
                <Rail gap={10}>
                  {shops.map((shop) => (
                    <Link
                      key={shop.id}
                      href={`/boutique/${shop.slug}`}
                      className="press flex w-[76px] flex-none flex-col items-center gap-[6px]"
                    >
                      <Avatar src={shop.logo_url} initials={monogram(shop.name)} size={52} />
                      <span className="line-clamp-2 text-center text-[0.625rem] leading-tight font-semibold text-[var(--color-ink)]">
                        {shop.name}
                      </span>
                    </Link>
                  ))}
                </Rail>
              </section>
            )}

            {products.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>
                  {format(t.search.productCount, { n: products.length })}
                </SectionTitle>
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
              </section>
            )}
          </>
        )}
      </div>

      {counts.cart > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px]">
          <Link
            href="/panier"
            aria-label={t.cart.title}
            className="press pointer-events-auto absolute end-4 bottom-[var(--nav-space)] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-white shadow-[0_14px_28px_rgba(109,75,143,0.38)]"
          >
            <span className="text-[0.8125rem] font-extrabold">{counts.cart}</span>
          </Link>
        </div>
      )}
    </>
  );
}
