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

  const [status, categories, counts, sponsored, liveShops, promo, services] = await Promise.all([
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
                    <Image
                      src={slot.image_url}
                      alt={slot.title}
                      width={260}
                      height={96}
                      className="h-24 w-full object-cover"
                    />
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

        {/* ─── 2 · En direct maintenant ───────────────────────────────── */}
        {withLiveFirst.length > 0 && (
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
        {promo.data && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.promos}</SectionTitle>
            <Link
              href={`/produit/${promo.data.id}`}
              className="overflow-hidden rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              {promo.data.images?.[0] ? (
                <Image
                  src={promo.data.images[0]}
                  alt={promo.data.name}
                  width={520}
                  height={150}
                  className="h-[150px] w-full object-cover"
                  priority
                />
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
