import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, createStaticClient } from "@/lib/supabase/server";
import { getSessionUser, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatCount, formatRating, formatTime, monogram } from "@/lib/format";
import { ProductCard } from "@/components/cards/product-card";
import { avecBlackFriday } from "@/lib/black-friday-server";
import { BoutonPartage } from "@/components/black-friday/share-button";
import { Card, EmptyState, Placeholder, Rail, Tag } from "@/components/ui/primitives";
import { CartIcon, PinIcon } from "@/components/ui/icons";
import { BackButton } from "@/components/shell/back";
import { CountShopView, FollowButton, ShopContact, ShopTabs } from "./shop-client";
import { jsonLd as jsonLdHtml } from "@/lib/json-ld";

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
      /*
        Plus d image ici : opengraph-image.tsx, a cote, fabrique la carte de
        partage. Une cle images declaree ici, meme a undefined, empechait
        l image du fichier d apparaitre : la boutique partagee arrivait sans
        aucun apercu, quand la fiche produit - sans cette cle - en avait un.
      */
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
       followers_count, posts_count, views_count, status, latitude, longitude,
       category:categories!shops_category_id_fkey(name_fr, name_ar, hue)`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!shop || shop.status !== "approved") notFound();

  const user = await getSessionUser();

  const [products, promo, hoursToday, subCategories, following, lives, counts] = await Promise.all([
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

    getTopBarCounts(),
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

  const lus = sous
    ? (products.data ?? []).filter(() => true) // filtrage sous-catégorie côté client-tabs
    : (products.data ?? []);

  /*
    Le prix Black Friday, lu avec le client anonyme : cette page est mise en
    cache cinq minutes, et le client de session la rendrait dynamique. La
    carte revérifie la fenêtre à l'affichage — une page servie depuis le cache
    après 00:01 le samedi ne montre donc pas une offre terminée.
  */
  const visible = await avecBlackFriday(lus, createStaticClient());

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-[var(--color-app)] lg:max-w-[1120px] lg:px-8 lg:py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
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
          /*
            `fill` dans un cadre de hauteur fixe, et un `sizes` déclaré.

            La couverture est recadrée : elle occupe toute la largeur sur une
            hauteur imposée, quel que soit le format du fichier envoyé par le
            commerçant. Déclarer 520 × 110 annonçait un rapport que le rendu ne
            tenait pas, et sans `sizes` le navigateur supposait la pleine largeur
            de l'écran — il téléchargeait donc une variante trop lourde pour un
            bandeau de cent-dix pixels.
          */
          <span className="relative block h-[110px] w-full flex-none">
            <Image
              src={shop.cover_url}
              alt=""
              fill
              priority
              sizes="(max-width: 520px) 100vw, 520px"
              className="object-cover"
            />
          </span>
        ) : (
          <Placeholder label="photo de couverture" className="h-[110px] w-full flex-none" />
        )}

        <div className="-mt-6 flex flex-none flex-col gap-2 px-4">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--color-app)] bg-[var(--color-brand-fill)] text-[1.125rem] font-bold text-white">
            {shop.logo_url ? (
              <Image src={shop.logo_url} alt="" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              monogram(shop.name)
            )}
          </span>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[1.1875rem] font-semibold text-[var(--color-ink)]">
                {locale === "ar" && shop.name_ar ? shop.name_ar : shop.name}
              </h1>
              <p className="text-[0.6875rem] text-[var(--color-muted)]">
                {locale === "ar" ? shop.category?.name_ar : shop.category?.name_fr}
                {shop.mall_level !== null && ` · Niveau ${shop.mall_level}`}
              </p>
              <div className="mt-2">
                <BoutonPartage
                  chemin={`/boutique/${shop.slug}`}
                  titre={shop.name}
                  texte={`${shop.name} — ${t.brand.first} ${t.brand.second}`}
                  image={`/partage/boutique/${shop.slug}`}
                />
              </div>
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

          <div className="mt-[2px] flex justify-between gap-3 text-[0.6875rem] text-[var(--color-muted)]">
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
            <p className="text-[0.75rem] leading-[1.5] text-[var(--color-ink)]">
              {locale === "ar" && shop.description_ar ? shop.description_ar : shop.description}
            </p>
          )}

          <div className="mt-[2px] flex flex-none items-center gap-2">
            <span className="flex items-center gap-[6px] rounded-[12px] bg-[var(--color-brand-tint)] px-[10px] py-[5px] text-[0.625rem] font-bold text-[var(--color-brand)]">
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

          {/*
            Où se trouve la boutique, et comment y aller.

            La page disait « Niveau 1 » dans une ligne de texte gris, sous le
            nom. Or c'est l'information qui décide du déplacement : quelqu'un
            qui consulte une vitrine depuis chez lui veut savoir s'il peut y
            passer. Elle prend donc une carte à elle, avec l'itinéraire au bout.

            L'itinéraire s'ouvre dans l'application de cartographie du
            téléphone : c'est elle qui connaît le trafic et qui parle pendant le
            trajet. Sans coordonnées, la carte reste et se contente d'indiquer
            le local — à l'intérieur d'un mall, « Niveau 1, local B12 » guide
            mieux qu'un point sur une carte.
          */}
          {(shop.mall_unit || (shop.latitude !== null && shop.longitude !== null)) && (
            <Card className="mt-1 flex items-center gap-[10px] p-[12px_13px]">
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
                <PinIcon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">
                  {shop.mall_unit
                    ? format(t.product.walkTime, {
                        level: shop.mall_level ?? 0,
                        unit: shop.mall_unit,
                        min: 3,
                      })
                    : t.shop.findUs}
                </p>
                <p className="text-[0.625rem] leading-[1.35] text-[var(--color-muted)]">
                  {locale === "ar" ? shop.category?.name_ar : shop.category?.name_fr}
                </p>
              </div>
              {shop.latitude !== null && shop.longitude !== null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="press flex-none rounded-[16px] bg-[var(--color-brand-fill)] px-[13px] py-2 text-[0.65625rem] font-bold whitespace-nowrap text-white shadow-[0_8px_18px_rgba(109,75,143,0.26)]"
                >
                  {t.shop.guideMe}
                </a>
              )}
            </Card>
          )}
        </div>

        <ShopTabs active={onglet} slug={shop.slug} liveCount={(lives.data ?? []).length} />

        <div className="no-sb flex flex-1 flex-col gap-[14px] px-4 pt-3 pb-4">
          {/* Chips de sous-catégories, chacune dans sa nuance */}
          {(subCategories.data ?? []).length > 0 && (
            <Rail className="flex-none" gap={8}>
              <span className="flex-none whitespace-nowrap rounded-[14px] bg-[var(--color-brand-fill)] px-[13px] py-[6px] text-[0.65625rem] font-semibold text-white">
                {t.common.all}
              </span>
              {subCategories.data!.map(({ category }) =>
                category ? (
                  <span
                    key={category.id}
                    className="cat-surface cat-ink flex-none whitespace-nowrap rounded-[14px] px-[13px] py-[6px] text-[0.65625rem] font-semibold"
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
              <span className="flex-none rounded-[14px] bg-[var(--color-live-fill)] px-[9px] py-[6px] text-[0.6875rem] font-bold text-white">
                −{promo.data.percent_off}%
              </span>
              <div className="min-w-0">
                <p className="text-[0.71875rem] font-semibold text-[var(--color-ink)]">
                  {locale === "ar" && promo.data.title_ar ? promo.data.title_ar : promo.data.title}
                </p>
                <p className="text-[0.65625rem] text-[var(--color-muted)]">
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
                  <span className="min-w-0 flex-1 truncate text-[0.71875rem] font-semibold">{live.title}</span>
                  <Tag tone={live.status === "live" ? "live" : "tinted"}>
                    {live.status === "live" ? t.live.onAir : t.live.scheduled}
                  </Tag>
                </a>
              ))
            )
          ) : visible.length === 0 ? (
            <EmptyState title={t.common.empty} />
          ) : (
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
          )}
        </div>

        {/*
          Le panier, à portée de pouce depuis la vitrine.

          On ajoute plusieurs articles d'affilée dans une même boutique, et rien
          ne menait ensuite à la caisse : il fallait quitter la page par la
          flèche de retour, puis retrouver l'icône du panier ailleurs. Cette
          page n'a pas de barre d'onglets — elle vit hors de la coque client —,
          d'où un bouton flottant plutôt qu'un onglet.
        */}
        {counts.cart > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px]">
            <Link
              href="/panier"
              aria-label={t.cart.title}
              className="press pointer-events-auto absolute end-4 bottom-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-white shadow-[0_14px_28px_rgba(109,75,143,0.38)]"
            >
              <CartIcon size={21} />
              <span className="absolute -top-[2px] -end-[2px] flex h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-[var(--color-app)] bg-[var(--color-ink)] px-1 text-[0.59375rem] font-extrabold text-[var(--color-app)]">
                {counts.cart > 99 ? "99+" : counts.cart}
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
