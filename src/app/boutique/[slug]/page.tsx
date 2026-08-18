import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, createStaticClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/dictionaries";
import { formatCount, formatRating, formatTime, monogram } from "@/lib/format";
import { ProductCard } from "@/components/cards/product-card";
import { EmptyState, Placeholder, Rail, Tag } from "@/components/ui/primitives";
import { BackButton } from "@/components/shell/back";
import { CountShopView, FollowButton, ShopContact, ShopTabs } from "./shop-client";

/**
 * Écran 6 — profil boutique, vue client.
 * Page publique indexable : c'est la vitrine en ligne du commerçant.
 */

export const revalidate = 300;

export async function generateStaticParams() {
  // Pré-rend les boutiques approuvées au build ; les nouvelles arrivent par
  // ISR à leur première visite. Client sans cookie : on est hors requête.
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("shops")
      .select("slug")
      .eq("status", "approved")
      .order("followers_count", { ascending: false })
      .limit(50);

    return (data ?? []).map(({ slug }) => ({ slug }));
  } catch {
    // Base injoignable au build : tout passera par l'ISR à la demande.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shops")
    .select("name, description, cover_url, mall_level, mall_unit")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) return { title: "Boutique introuvable" };

  const place = data.mall_unit ? ` — Niveau ${data.mall_level}, local ${data.mall_unit}` : "";

  return {
    title: `${data.name} — Mall de Gafsa`,
    description:
      data.description ?? `${data.name}${place}. Découvrez ses produits sur Mall Express Gafsa.`,
    alternates: { canonical: `/boutique/${slug}` },
    openGraph: {
      title: data.name,
      description: data.description ?? undefined,
      images: data.cover_url ? [data.cover_url] : undefined,
    },
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onglet?: string; sous?: string }>;
}) {
  const { slug } = await params;
  const { onglet = "products", sous } = await searchParams;
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      `id, name, name_ar, description, description_ar, slug, logo_url, cover_url,
       mall_level, mall_unit, phone, is_open_now, rating_sum, rating_count,
       followers_count, posts_count, views_count, status,
       category:categories!shops_category_id_fkey(name_fr, name_ar, hue)`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!shop || shop.status !== "approved") notFound();

  const user = await getSessionUser();

  const [products, promo, hoursToday, subCategories, following, lives] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, compare_at_price, images, stock, category:categories(hue)")
      .eq("shop_id", shop.id)
      .eq("is_online", true)
      .eq("is_draft", false)
      .order("sold_count", { ascending: false })
      .limit(24),

    supabase
      .from("promotions")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .gte("ends_at", new Date().toISOString())
      .order("percent_off", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("shop_hours")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("weekday", (new Date().getDay() + 6) % 7)
      .maybeSingle(),

    supabase
      .from("shop_categories")
      .select("category:categories(id, slug, name_fr, name_ar, hue)")
      .eq("shop_id", shop.id),

    user
      ? supabase
          .from("shop_follows")
          .select("shop_id")
          .match({ user_id: user.id, shop_id: shop.id })
          .maybeSingle()
          .then(({ data }) => Boolean(data))
      : Promise.resolve(false),

    supabase
      .from("lives")
      .select("id, title, status, scheduled_at")
      .eq("shop_id", shop.id)
      .in("status", ["live", "scheduled"])
      .order("scheduled_at")
      .limit(5),
  ]);

  const rating = formatRating(shop.rating_sum, shop.rating_count);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    description: shop.description ?? undefined,
    image: shop.cover_url ?? undefined,
    telephone: shop.phone ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gafsa",
      addressCountry: "TN",
      streetAddress: shop.mall_unit ? `Niveau ${shop.mall_level}, local ${shop.mall_unit}` : undefined,
    },
    ...(shop.rating_count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount: shop.rating_count,
      },
    }),
  };

  const visible = sous
    ? (products.data ?? []).filter(() => true) // filtrage sous-catégorie côté client-tabs
    : (products.data ?? []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-[var(--color-app)] lg:max-w-[1120px] lg:px-8 lg:py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main id="contenu" className="no-sb relative flex flex-1 flex-col overflow-y-auto">
        {/*
          Une porte de sortie sur la vitrine.

          Cette page n'avait aucune flèche de retour : un visiteur arrivé par un
          lien partagé n'avait que le bouton du navigateur, qui le renvoyait hors
          du site ou sur la page de présentation. La flèche flotte au-dessus de la
          photo de couverture, faute de barre supérieure sur cet écran.
        */}
        <div className="absolute z-20 p-3">
          <BackButton
            fallback="/marketplace"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.88)] text-[var(--color-ink)] shadow-[0_2px_8px_rgba(30,20,45,0.25)] backdrop-blur-sm"
          />
        </div>

        {shop.cover_url ? (
          <Image
            src={shop.cover_url}
            alt=""
            width={520}
            height={110}
            priority
            className="h-[110px] w-full flex-none object-cover"
          />
        ) : (
          <Placeholder label="photo de couverture" className="h-[110px] w-full flex-none" />
        )}

        <div className="-mt-6 flex flex-none flex-col gap-2 px-4">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--color-app)] bg-[var(--color-brand)] text-[18px] font-bold text-white">
            {shop.logo_url ? (
              <Image src={shop.logo_url} alt="" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              monogram(shop.name)
            )}
          </span>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[19px] font-semibold text-[var(--color-ink)]">
                {locale === "ar" && shop.name_ar ? shop.name_ar : shop.name}
              </h1>
              <p className="text-[11px] text-[var(--color-muted)]">
                {locale === "ar" ? shop.category?.name_ar : shop.category?.name_fr}
                {shop.mall_level !== null && ` · Niveau ${shop.mall_level}`}
              </p>
            </div>
            <FollowButton shopId={shop.id} initiallyFollowing={following} />
            {/*
              La visite est comptée depuis le navigateur, et non pendant le rendu :
              cette page est servie en cache cinq minutes (`revalidate = 300`), si
              bien qu'un incrément côté serveur n'aurait compté qu'une visite par
              intervalle, quel que soit le nombre de visiteurs réels.
            */}
            <CountShopView shopId={shop.id} />
          </div>

          <div className="mt-[2px] flex justify-between gap-3 text-[11px] text-[var(--color-muted)]">
            <span className="whitespace-nowrap">
              <b className="text-[var(--color-ink)]">{formatCount(shop.posts_count)}</b> {t.shop.posts}
            </span>
            <span className="whitespace-nowrap">
              <b className="text-[var(--color-ink)]">{formatCount(shop.followers_count)}</b>{" "}
              {t.shop.followers}
            </span>
            <span className="whitespace-nowrap">
              <b className="text-[var(--color-ink)]">{formatCount(shop.views_count)}</b>{" "}
              {t.common.views}
            </span>
            <span className="whitespace-nowrap">
              <b className="text-[var(--color-ink)]">{rating}</b> ★ {t.shop.reviews}
            </span>
          </div>

          {(shop.description || shop.description_ar) && (
            <p className="text-[12px] leading-[1.5] text-[var(--color-ink)]">
              {locale === "ar" && shop.description_ar ? shop.description_ar : shop.description}
            </p>
          )}

          <div className="mt-[2px] flex flex-none items-center gap-2">
            <span className="flex items-center gap-[6px] rounded-[12px] bg-[var(--color-brand-tint)] px-[10px] py-[5px] text-[10px] font-bold text-[var(--color-brand)]">
              <span
                className={`inline-block h-[6px] w-[6px] rounded-full ${
                  shop.is_open_now ? "bg-[var(--color-success)]" : "bg-[var(--color-faint)]"
                }`}
              />
              {shop.is_open_now && hoursToday.data?.closes_at
                ? format(t.shop.openUntil, { time: formatTime(hoursToday.data.closes_at) })
                : t.shop.closed}
            </span>

            {/*
              Trois portes vers le vendeur, et non plus une seule.

              Le lien précédent choisissait à la place du visiteur : un numéro
              renseigné menait à l'appel, et la messagerie du site devenait
              alors inaccessible depuis la boutique — alors qu'elle est le seul
              canal qui laisse une trace consultable des deux côtés. Un client
              qui veut écrire à 23 h n'appelle pas ; un client pressé n'écrit pas.
            */}
            <ShopContact
              shopId={shop.id}
              shopName={shop.name}
              phone={shop.phone}
              labels={{
                message: t.shop.askVendor,
                call: t.taxi.call,
                whatsApp: t.common.whatsApp,
              }}
            />
          </div>
        </div>

        <ShopTabs active={onglet} slug={shop.slug} liveCount={(lives.data ?? []).length} />

        <div className="no-sb flex flex-1 flex-col gap-[14px] px-4 pt-3 pb-4">
          {/* Chips de sous-catégories, chacune dans sa nuance */}
          {(subCategories.data ?? []).length > 0 && (
            <Rail className="flex-none" gap={8}>
              <span className="flex-none whitespace-nowrap rounded-[14px] bg-[var(--color-brand)] px-[13px] py-[6px] text-[10.5px] font-semibold text-white">
                {t.common.all}
              </span>
              {subCategories.data!.map(({ category }) =>
                category ? (
                  <span
                    key={category.id}
                    className="cat-surface cat-ink flex-none whitespace-nowrap rounded-[14px] px-[13px] py-[6px] text-[10.5px] font-semibold"
                    style={{ "--hue": category.hue } as React.CSSProperties}
                  >
                    {locale === "ar" ? category.name_ar : category.name_fr}
                  </span>
                ) : null,
              )}
            </Rail>
          )}

          {promo.data && (
            <div className="flex flex-none items-center gap-[10px] rounded-[18px] border border-[rgba(122,31,43,0.15)] bg-[var(--color-brand-tint)] p-[10px]">
              <span className="flex-none rounded-[14px] bg-[var(--color-live)] px-[9px] py-[6px] text-[11px] font-bold text-white">
                −{promo.data.percent_off}%
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-[var(--color-ink)]">
                  {locale === "ar" && promo.data.title_ar ? promo.data.title_ar : promo.data.title}
                </p>
                <p className="text-[10.5px] text-[var(--color-muted)]">
                  {t.deals.validUntil} {new Date(promo.data.ends_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          )}

          {onglet === "lives" ? (
            (lives.data ?? []).length === 0 ? (
              <EmptyState title={t.live.noneLive} />
            ) : (
              lives.data!.map((live) => (
                <a
                  key={live.id}
                  href={`/lives/${live.id}`}
                  className="flex items-center gap-2 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
                >
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{live.title}</span>
                  <Tag tone={live.status === "live" ? "live" : "tinted"}>
                    {live.status === "live" ? t.live.onAir : t.live.scheduled}
                  </Tag>
                </a>
              ))
            )
          ) : visible.length === 0 ? (
            <EmptyState title={t.common.empty} />
          ) : (
            <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{ ...product, shop: null }}
                  locale={locale}
                  showShop={false}
                  imageHeight={100}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
