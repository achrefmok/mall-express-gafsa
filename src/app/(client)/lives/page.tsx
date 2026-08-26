import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatCount, formatDateTime, formatPrice, monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Placeholder, SectionTitle, Tag } from "@/components/ui/primitives";
import { LiveDot } from "@/components/ui/icons";
import { lienProduit } from "@/lib/product-url";

export const metadata: Metadata = {
  title: "Ventes en direct des boutiques de Gafsa",
  description: "Suivez les ventes en direct des commerçants du mall de Gafsa et achetez sans quitter le flux.",
  alternates: { canonical: "/lives" },
};

export const dynamic = "force-dynamic";

export default async function LivesPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: lives } = await supabase
    .from("lives")
    .select(
      `id, title, title_ar, cover_url, status, scheduled_at, started_at, viewers_count, source,
       shop:shops!inner(name, slug, logo_url, status),
       live_products(product:products(id, name, price, images, is_online, is_draft))`,
    )
    .in("status", ["live", "scheduled", "ended"])
    .eq("shops.status", "approved")
    .order("status")
    .order("scheduled_at", { ascending: true })
    .limit(30);

  const all = lives ?? [];
  const onAir = all.filter((l) => l.status === "live");
  const upcoming = all.filter((l) => l.status === "scheduled");
  const past = all.filter((l) => l.status === "ended").slice(0, 8);

  return (
    <>
      <TopBar title={t.nav.lives} />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
        {onAir.length === 0 && upcoming.length === 0 && past.length === 0 && (
          <EmptyState title={t.live.noneLive} body={t.live.endedBody} />
        )}

        {onAir.length > 0 && (
          <section className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:content-start">
            <SectionTitle className="lg:col-span-full">
              <span className="inline-flex items-center gap-[6px]">
                <LiveDot size={7} />
                {t.home.liveNow}
              </span>
            </SectionTitle>

            {onAir.map((live) => (
              <Link key={live.id} href={`/lives/${live.id}`} className="relative overflow-hidden rounded-[18px]">
                {live.cover_url ? (
                  <Image
                    src={live.cover_url}
                    alt=""
                    width={520}
                    height={180}
                    className="h-[180px] w-full object-cover"
                  />
                ) : (
                  <Placeholder label="flux vidéo en direct" className="h-[180px] w-full bg-[#221c2b]" />
                )}

                <span className="absolute start-3 top-3 rounded-[4px] bg-[var(--color-live-fill)] px-[9px] py-1 text-[0.625rem] font-bold tracking-[0.03125rem] text-white">
                  {t.live.onAir}
                </span>
                <span className="absolute end-3 top-3 rounded-[12px] bg-black/50 px-[9px] py-1 text-[0.625rem] text-white">
                  {format(t.live.viewers, { n: formatCount(live.viewers_count) })}
                </span>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-[0.8125rem] font-bold text-white">
                    {locale === "ar" && live.title_ar ? live.title_ar : live.title}
                  </p>
                  <p className="text-[0.65625rem] text-white/80">{live.shop?.name}</p>
                </div>
              </Link>
            ))}
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:content-start">
            <SectionTitle className="lg:col-span-full">{t.live.upcoming}</SectionTitle>
            {upcoming.map((live) => (
              <Card key={live.id} className="flex items-center gap-[10px] p-[11px]">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.6875rem] font-bold text-[var(--color-brand)]">
                  {monogram(live.shop?.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
                    {locale === "ar" && live.title_ar ? live.title_ar : live.title}
                  </p>
                  <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                    {live.shop?.name}
                    {live.scheduled_at && ` · ${formatDateTime(live.scheduled_at, locale)}`}
                  </p>
                </div>
                <Tag tone="tinted">{t.live.scheduled}</Tag>
              </Card>
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:content-start">
            <SectionTitle className="lg:col-span-full">{t.live.past}</SectionTitle>
            {past.map((live) => {
              /*
                Ce qui a été présenté pendant ce direct.

                Un direct terminé n'a plus de vidéo à montrer, mais les articles,
                eux, restent en vente. Les afficher transforme une ligne morte en
                vitrine : le client a manqué le direct, il peut encore acheter ce
                qu'on y présentait.

                Les articles retirés de la vitrine sont écartés — un direct passé
                ne doit pas ressusciter ce que la boutique a dépublié.
              */
              const articles = (live.live_products ?? [])
                .map((row) => row.product)
                .filter((product) => product && product.is_online && !product.is_draft);

              return (
                <Card key={live.id} className="flex flex-col gap-[9px] p-[11px]">
                  <div className="flex items-center gap-[10px]">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-track)] text-[0.6875rem] font-bold text-[var(--color-muted)]">
                      {monogram(live.shop?.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
                        {live.title}
                      </p>
                      <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                        {live.shop?.name}
                      </p>
                    </div>
                  </div>

                  {articles.length > 0 && (
                    <div className="no-sb -mx-[11px] flex gap-2 overflow-x-auto px-[11px]">
                      {articles.map((product) => (
                        <Link
                          key={product!.id}
                          href={lienProduit(product!)}
                          className="flex w-[92px] flex-none flex-col gap-1"
                        >
                          {product!.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vignette 92px, hors flux Next/Image
                            <img
                              src={product!.images[0]}
                              alt=""
                              className="h-[92px] w-[92px] rounded-[14px] object-cover"
                            />
                          ) : (
                            <Placeholder className="h-[92px] w-[92px]" rounded="tile" />
                          )}
                          <p className="truncate text-[0.625rem] font-semibold text-[var(--color-ink)]">
                            {product!.name}
                          </p>
                          <p className="text-[0.65625rem] font-bold text-[var(--color-brand)]">
                            {formatPrice(product!.price, locale)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
