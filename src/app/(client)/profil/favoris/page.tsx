import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatCount, monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { ProductCard } from "@/components/cards/product-card";
import { Avatar, ButtonLink, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { ChevronRightIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Favoris",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/profil/favoris");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const [favorites, follows] = await Promise.all([
    supabase
      .from("favorites")
      .select(
        `product:products(id, name, price, compare_at_price, images, stock,
         shop:shops(name, slug), category:categories(hue))`,
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(40),

    supabase
      .from("shop_follows")
      .select("shop:shops(id, name, slug, logo_url, followers_count, is_open_now)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const products = (favorites.data ?? []).map((row) => row.product).filter(Boolean);
  const shops = (follows.data ?? []).map((row) => row.shop).filter(Boolean);

  return (
    <>
      <TopBar title={t.account.favoriteShops} back="/profil" />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
        {products.length === 0 && shops.length === 0 && (
          <EmptyState
            title={t.common.empty}
            body="Le cœur sur une fiche produit et « Suivre » sur une boutique les rangent ici."
            action={
              <ButtonLink href="/marketplace" size="sm" className="mt-1">
                {t.nav.marketplace}
              </ButtonLink>
            }
          />
        )}

        {shops.length > 0 && (
          <section className="flex flex-none flex-col gap-2">
            <SectionTitle>{t.account.favoriteShops}</SectionTitle>
            {shops.map((shop) => (
              <Link key={shop!.id} href={`/boutique/${shop!.slug}`}>
                <Card className="flex items-center gap-[10px] p-3">
                  <Avatar src={shop!.logo_url} initials={monogram(shop!.name)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
                      {shop!.name}
                    </p>
                    <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                      {formatCount(shop!.followers_count)} {t.shop.followers}
                      {" · "}
                      {shop!.is_open_now ? t.shop.openUntil.replace(" · ferme à {time}", "") : t.shop.closed}
                    </p>
                  </div>
                  <ChevronRightIcon size={14} className="flex-none text-[var(--color-faint)]" />
                </Card>
              </Link>
            ))}
          </section>
        )}

        {products.length > 0 && (
          <section className="flex flex-none flex-col gap-2">
            <SectionTitle>{t.account.favorites}</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product!.id} product={product!} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
