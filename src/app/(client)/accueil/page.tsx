import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMallStatus, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/dictionaries";
import { formatPrice, monogram, percentOff } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { SearchBar } from "@/components/shell/search-bar";
import { AccessibilityBar } from "@/components/shell/accessibility-bar";
import { NotifyLiveButton } from "@/components/live/notify-live-button";
import { ProductCard } from "@/components/cards/product-card";
import { ImageZoom } from "@/components/ui/image-zoom";
import { Avatar, Card, CategoryTile, Placeholder, Rail, SectionTitle } from "@/components/ui/primitives";
import { LiveDot } from "@/components/ui/icons";
import type { PracticalService } from "@/types/database";

export const metadata: Metadata = {
  title: "Mall Express Gafsa — boutiques, marketplace et services",
  alternates: { canonical: "/accueil" },
};

// Le fil bouge sans arrêt (lives, promos, sponsors) : rendu à la demande,
// mais mis en cache une minute pour absorber les pics.
export const revalidate = 60;

export default async function HomePage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [
    status,
    categories,
    counts,
    sponsored,
    liveShops,
    promo,
    shopPromos,
    catalogue,
    services,
  ] = await Promise.all([
    getMallStatus(),
    getCategories(),
    getTopBarCounts(),

    supabase
      .from("sponsored_slots")
      .select("*")
      .eq("is_active", true)
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString())
      .order("position")
      .limit(6),

    // Boutiques en direct d'abord, puis les plus suivies — la rangée
    // d'avatars ne doit jamais être vide.
    supabase
      .from("shops")
      .select("id, name, slug, logo_url, followers_count, lives(id, status)")
      .eq("status", "approved")
      .order("followers_count", { ascending: false })
      .limit(10),

    supabase
      .from("products")
      .select("id, name, name_ar, price, compare_at_price, images, description_ar, shop:shops!inner(name, slug, logo_url, status)")
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved")
      .not("compare_at_price", "is", null)
      .order("sold_count", { ascending: false })
      .limit(1)
      .maybeSingle(),

    /*
      Les promotions de boutique, absentes de cet écran jusqu'ici.

      La requête voisine ne cherche qu'un produit à prix barré : deux mécanismes
      distincts, et un commerçant qui créait « −10% sur toute la boutique » ne
      voyait rien apparaître ici. C'était le défaut le plus visible pour un
      vendeur, puisqu'il croyait sa promotion perdue.

      Les trois bornes comptent autant l'une que l'autre : active, commencée, non
      expirée. Sans la borne de début, une promotion programmée pour la semaine
      prochaine s'afficherait aujourd'hui ; sans celle de fin, elle resterait
      après son terme — le pire des deux, puisqu'un client s'y déplacerait.

      `shops!inner` avec le filtre de statut : une boutique suspendue ne doit pas
      continuer d'annoncer ses remises depuis la page d'accueil.
    */
    supabase
      .from("promotions")
      .select("id, title, title_ar, percent_off, ends_at, shop:shops!inner(name, slug, logo_url, status)")
      .eq("is_active", true)
      .eq("shops.status", "approved")
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString())
      .order("percent_off", { ascending: false })
      .limit(6),

    /*
      De quoi remplir l'écran quand aucun direct n'est en cours.

      Le rail des directs est vide la plupart du temps — un commerçant diffuse
      une heure par semaine, pas en continu — et l'accueil s'ouvrait alors sur
      une bande de pastilles grises qui ne menaient nulle part. Autant montrer
      ce que les boutiques mises en avant ont à vendre.

      Une seule requête, large, plutôt que deux : on demande douze articles des
      boutiques approuvées et l'on choisit ensuite ceux des boutiques à la une.
      Interroger d'abord les boutiques mises en avant aurait ajouté un
      aller-retour, et rendu la section vide le jour où plus aucune ne l'est.
    */
    supabase
      .from("products")
      .select(
        "id, name, price, compare_at_price, images, stock, category:categories(hue), shop:shops!inner(name, slug, status, is_featured)",
      )
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved")
      .gt("stock", 0)
      .order("sold_count", { ascending: false })
      .limit(12),

    supabase
      .from("practical_services")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(8),
  ]);

  // Une tuile par type de service pratique (Taxi, Louage, Prière, Pharmacie)
  const serviceTiles = Object.values(
    (services.data ?? []).reduce<Record<string, PracticalService>>((acc, service) => {
      acc[service.kind] ??= service;
      return acc;
    }, {}),
  );

  const shops = liveShops.data ?? [];
  const withLiveFirst = [...shops].sort((a, b) => {
    const aLive = a.lives?.some((l) => l.status === "live") ? 1 : 0;
    const bLive = b.lives?.some((l) => l.status === "live") ? 1 : 0;
    return bLive - aLive;
  });

  /*
    Y a-t-il vraiment un direct à l'antenne ?

    Le rail affiche toutes les boutiques, celles qui diffusent en tête. Sans
    aucun direct, il ne restait qu'une bande de pastilles grises sous un titre
    qui promettait « en direct maintenant » — le genre de section qu'on apprend
    à ignorer.
  */
  const anyLive = shops.some((shop) => shop.lives?.some((l) => l.status === "live"));

  /*
    Trois articles pour prendre la place, en préférant les boutiques à la une.

    La préférence se fait ici plutôt que dans la requête : PostgREST ne trie pas
    sur une colonne de table jointe, et un second appel n'aurait servi qu'à
    obtenir un ordre. Si aucune boutique n'est mise en avant, on garde les plus
    vendus — la section reste pleine, ce qui est tout son intérêt.
  */
  const allProducts = catalogue.data ?? [];
  const featured = allProducts.filter((p) => p.shop?.is_featured);
  const highlights = (featured.length > 0 ? featured : allProducts).slice(0, 3);

  const next = status.nextLive;
  const minutesToLive = next?.scheduled_at
    ? Math.max(0, Math.round((new Date(next.scheduled_at).getTime() - Date.now()) / 60_000))
    : null;

  const discount = promo.data ? percentOff(promo.data.price, promo.data.compare_at_price) : null;

  return (
    <>
      <TopBar brand icons={["messages", "notifications", "cart"]} counts={counts} className="pb-[6px]" />
      <SearchBar />

      <div className="no-sb flex flex-1 flex-col gap-[18px] overflow-y-auto pt-3 pb-4">
        <AccessibilityBar />

        {/* ─── Bandeau contextuel ─────────────────────────────────────── */}
        <Card className="mx-4 flex flex-none items-center gap-[10px] p-[11px_13px]">
          <LiveDot size={8} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
              {format(status.anyOpen ? t.home.contextOpen : t.home.contextClosed, {
                n: status.anyOpen ? status.openCount : status.totalCount,
              })}
            </p>
            <p className="truncate text-[10.5px] text-[var(--color-muted)]">
              {next && minutesToLive !== null
                ? format(t.home.nextLive, { shop: next.shop?.name ?? "", min: minutesToLive })
                : t.home.noLive}
            </p>
          </div>
          {next && <NotifyLiveButton liveId={next.id} />}
        </Card>

        {/* ─── 1 · Sponsorisé ─────────────────────────────────────────── */}
        {(sponsored.data ?? []).length > 0 && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.sponsored}</SectionTitle>
            <Rail>
              {sponsored.data!.map((slot) => (
                <Link
                  key={slot.id}
                  href={slot.link_url ?? (slot.shop_id ? `/boutique/${slot.shop_id}` : "#")}
                  className="relative w-[260px] flex-none overflow-hidden rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
                >
                  <span className="absolute end-2 top-2 z-10 rounded-[3px] bg-[rgba(36,31,28,0.65)] px-[6px] py-[2px] text-[8px] tracking-[0.4px] text-white">
                    {t.home.sponsoredBadge}
                  </span>
                  {slot.image_url ? (
                    // Une bannière d'annonceur porte souvent un texte fin —
                    // dates, conditions, adresse — illisible sur 96 pixels.
                    <ImageZoom
                      images={[slot.image_url]}
                      alt={slot.title}
                      className="block w-full cursor-zoom-in"
                    >
                      <Image
                        src={slot.image_url}
                        alt={slot.title}
                        width={260}
                        height={96}
                        className="h-24 w-full object-cover"
                      />
                    </ImageZoom>
                  ) : (
                    <Placeholder label="bannière — annonceur" className="h-24 w-full" />
                  )}
                  <div className="p-[10px]">
                    <p className="text-[11.5px] font-semibold text-[var(--color-ink)]">{slot.title}</p>
                    {slot.subtitle && (
                      <p className="text-[10.5px] text-[var(--color-muted)]">{slot.subtitle}</p>
                    )}
                  </div>
                </Link>
              ))}
            </Rail>
          </section>
        )}

        {/*
          ─── 2 · En direct maintenant, ou la sélection ─────────────────

          L'une ou l'autre, jamais les deux. Un direct est un rendez-vous : tant
          qu'il en existe un, rien ne doit lui disputer cette place. Le reste du
          temps — c'est-à-dire presque toujours — la place revient à ce que les
          boutiques mises en avant ont à vendre.
        */}
        {!anyLive && highlights.length > 0 && (
          <section className="flex flex-col gap-2 px-4">
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle>{t.home.featured}</SectionTitle>
              <Link href="/marketplace" className="text-[10.5px] font-bold text-[var(--color-brand)]">
                {t.common.seeAll}
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-[10px]">
              {highlights.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} imageHeight={92} />
              ))}
            </div>
          </section>
        )}

        {anyLive && withLiveFirst.length > 0 && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.liveNow}</SectionTitle>
            <Rail gap={14}>
              {withLiveFirst.map((shop) => {
                const live = shop.lives?.find((l) => l.status === "live");
                return (
                  <Link
                    key={shop.id}
                    href={live ? `/lives/${live.id}` : `/boutique/${shop.slug}`}
                    className="relative flex flex-none flex-col items-center gap-[5px]"
                  >
                    <span
                      className={
                        live
                          ? "flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-[var(--color-live)] text-[10px] font-bold text-[var(--color-brand)]"
                          : "flex h-[58px] w-[58px] items-center justify-center rounded-full border-[1.5px] border-[var(--color-track)] text-[10px] font-bold text-[var(--color-muted)]"
                      }
                    >
                      {shop.logo_url ? (
                        <Image
                          src={shop.logo_url}
                          alt=""
                          width={54}
                          height={54}
                          className="h-[54px] w-[54px] rounded-full object-cover"
                        />
                      ) : (
                        monogram(shop.name)
                      )}
                    </span>
                    {live && (
                      <span className="absolute bottom-4 start-1/2 -translate-x-1/2 rounded-[3px] bg-[var(--color-live)] px-[5px] py-[1px] text-[7px] font-bold text-white rtl:translate-x-1/2">
                        LIVE
                      </span>
                    )}
                    <span className="max-w-[64px] truncate text-[10px] text-[var(--color-muted)]">
                      {shop.name}
                    </span>
                  </Link>
                );
              })}
            </Rail>
          </section>
        )}

        {/* ─── 3 · Promotions du moment ───────────────────────────────── */}
        {(promo.data || (shopPromos.data ?? []).length > 0) && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.promos}</SectionTitle>

            {/*
              Les remises de boutique, en tête et sur un rail.

              Elles portent sur un commerce entier, là où la carte qui suit
              porte sur un seul article : les présenter dans le même format
              laisserait croire à un produit en promotion, et le client
              chercherait un prix qui n'existe pas. D'où une tuile compacte qui
              nomme la boutique et mène à sa page, où la remise est détaillée.
            */}
            {(shopPromos.data ?? []).length > 0 && (
              <Rail gap={10}>
                {(shopPromos.data ?? []).map((offer) => (
                  <Link
                    key={offer.id}
                    href={`/boutique/${offer.shop?.slug}`}
                    className="flex w-[196px] flex-none items-center gap-[10px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[10px] shadow-[var(--shadow-card)]"
                  >
                    <Avatar
                      src={offer.shop?.logo_url}
                      initials={monogram(offer.shop?.name)}
                      size={34}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
                        {offer.shop?.name}
                      </p>
                      <p className="truncate text-[10px] text-[var(--color-muted)]">
                        {locale === "ar" && offer.title_ar ? offer.title_ar : offer.title}
                      </p>
                    </div>
                    <span className="flex-none rounded-[10px] bg-[var(--color-live)] px-2 py-[3px] text-[9.5px] font-bold text-white">
                      −{offer.percent_off}%
                    </span>
                  </Link>
                ))}
              </Rail>
            )}

            {promo.data && (
            <Link
              href={`/produit/${promo.data.id}`}
              className="overflow-hidden rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              {promo.data.images?.[0] ? (
                <ImageZoom
                  images={promo.data.images}
                  alt={promo.data.name}
                  className="block w-full cursor-zoom-in"
                >
                  <Image
                    src={promo.data.images[0]}
                    alt={promo.data.name}
                    width={520}
                    height={150}
                    className="h-[150px] w-full object-cover"
                    priority
                  />
                </ImageZoom>
              ) : (
                <Placeholder label="photo boutique — vitrine" className="h-[150px] w-full" />
              )}
              <div className="p-3">
                <div className="mb-[6px] flex items-center gap-2">
                  <Avatar
                    src={promo.data.shop?.logo_url}
                    initials={monogram(promo.data.shop?.name)}
                    size={18}
                  />
                  <span className="text-[11.5px] font-semibold">{promo.data.shop?.name}</span>
                  {discount !== null && (
                    <span className="ms-auto rounded-[10px] bg-[var(--color-live)] px-2 py-[3px] text-[9.5px] font-bold text-white">
                      −{discount}%
                    </span>
                  )}
                </div>
                <p className="mb-1 text-[16px] font-semibold text-[var(--color-ink)]">
                  {locale === "ar" && promo.data.name_ar ? promo.data.name_ar : promo.data.name}
                </p>
                {promo.data.description_ar && (
                  <p lang="ar" dir="rtl" className="text-[11.5px] leading-[1.5] text-[var(--color-muted)]">
                    {promo.data.description_ar}
                  </p>
                )}
                <p className="mt-2 text-[13px] font-bold text-[var(--color-brand)]">
                  {formatPrice(promo.data.price, locale)}
                </p>
              </div>
            </Link>
            )}
          </section>
        )}

        {/* ─── 4 · Catégories ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-[10px] px-4">
          <SectionTitle>{t.home.categories}</SectionTitle>
          <div className="grid grid-cols-4 gap-[10px] lg:grid-cols-6">
            {categories.slice(0, 7).map((category) => (
              <CategoryTile
                key={category.id}
                hue={category.hue}
                monogram={category.monogram}
                label={locale === "ar" ? category.name_ar : category.name_fr}
                href={`/marketplace?categorie=${category.slug}`}
              />
            ))}
            <CategoryTile hue={20} monogram="+" label={t.home.more} href="/marketplace" />
          </div>
        </section>

        {/* ─── 5 · Services pratiques ─────────────────────────────────── */}
        {serviceTiles.length > 0 && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.practicalServices}</SectionTitle>
            <Rail>
              {serviceTiles.map((service) => (
                <Link
                  key={service.id}
                  href={`/services#${service.kind}`}
                  className="flex w-[84px] flex-none flex-col items-center gap-[6px] rounded-[10px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[10px_6px] shadow-[var(--shadow-card)]"
                >
                  <span
                    className="cat-surface cat-ink flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px] font-semibold tracking-[0.5px]"
                    style={{ "--hue": service.hue } as React.CSSProperties}
                  >
                    {service.monogram}
                  </span>
                  <span className="text-center text-[9.5px] leading-tight text-[var(--color-ink)]">
                    {locale === "ar" && service.name_ar ? service.name_ar : service.name}
                  </span>
                </Link>
              ))}
            </Rail>
          </section>
        )}

        {/* ─── 6 · Invitation commerçants ─────────────────────────────── */}
        <div className="mx-4 flex flex-none items-center gap-3 rounded-[18px] bg-[image:var(--gradient-brand)] p-[14px] text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold">{t.home.merchantTitle}</p>
            <p className="text-[10.5px] leading-[1.45] opacity-85">{t.home.merchantBody}</p>
          </div>
          <Link
            href="/inscription?role=vendeur"
            className="flex-none whitespace-nowrap rounded-[13px] bg-white px-3 py-[7px] text-[10.5px] font-bold text-[var(--color-ink)]"
          >
            {t.home.merchantCta}
          </Link>
        </div>
      </div>
    </>
  );
}
