import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatCount, formatDateTime, formatPrice } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Fab, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Mes directs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SOURCE_LABEL = { camera: "sourceCamera", facebook: "sourceFacebook", hls: "sourceHls" } as const;

export default async function VendorLivesPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: lives } = await supabase
    .from("lives")
    .select(
      `id, title, status, source, scheduled_at, started_at, peak_viewers, purchases_count,
       live_products(product:products(name, price))`,
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <>
      <TopBar title={t.nav.lives} />

      <div className="no-sb flex flex-1 flex-col gap-[10px] overflow-y-auto px-4 pt-2 pb-[80px]">
        {(lives ?? []).length === 0 ? (
          <EmptyState title={t.live.noneLive} body={t.vendor.newLive} />
        ) : (
          lives!.map((live) => (
            <Link key={live.id} href={`/vendeur/lives/${live.id}`}>
              <Card className="flex items-center gap-[10px] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
                    {live.title}
                  </p>
                  <p className="truncate text-[10px] text-[var(--color-muted)]">
                    {t.live[SOURCE_LABEL[live.source]]}
                    {live.scheduled_at && ` · ${formatDateTime(live.scheduled_at, locale)}`}
                  </p>
                  {live.status === "ended" && (
                    <p className="text-[10px] text-[var(--color-muted)]">
                      {formatCount(live.peak_viewers)} · {live.purchases_count} achats
                    </p>
                  )}

                  {/*
                    Ce qui a été présenté, et à quel prix.

                    « 1 · 0 achats » ne dit rien de la vente : le vendeur ne
                    reconnaît pas son direct dans ces deux chiffres. La liste des
                    articles, elle, lui rappelle immédiatement de quoi il s'agit —
                    et c'est aussi le seul endroit où il retrouve ce qu'il a
                    ajouté au vol pendant la diffusion.
                  */}
                  {live.live_products?.length > 0 && (
                    <p className="mt-[3px] truncate text-[10px] text-[var(--color-brand)]">
                      {t.live.recap} :{" "}
                      {live.live_products
                        .map((row) => row.product)
                        .filter((product) => product)
                        .map((product) => `${product!.name} ${formatPrice(product!.price, locale)}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <Tag
                  tone={
                    live.status === "live" ? "live" : live.status === "ended" ? "outline" : "tinted"
                  }
                >
                  {live.status === "live"
                    ? t.live.onAir
                    : live.status === "ended"
                      ? t.live.ended
                      : t.live.scheduled}
                </Tag>
              </Card>
            </Link>
          ))
        )}
      </div>

      <Fab href="/vendeur/lives/nouveau">+ {t.vendor.newLive}</Fab>
    </>
  );
}
