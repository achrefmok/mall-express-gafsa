import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatCount, formatRating, monogram, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Tag } from "@/components/ui/primitives";
import { PendingShopRow } from "../admin-client";
import { FeatureToggle } from "./shops-client";

export const metadata: Metadata = {
  title: "Boutiques",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminShopsPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: shops } = await supabase
    .from("shops")
    .select(
      "id, name, slug, status, is_featured, followers_count, rating_sum, rating_count, submitted_at, missing_document, category:categories!shops_category_id_fkey(hue, name_fr), products:products(id)",
    )
    .order("is_featured", { ascending: false })
    .order("followers_count", { ascending: false })
    .limit(100);

  const statusLabel = (status: string) =>
    status === "pending" ? t.admin.shopStatusPending : status === "rejected" ? t.admin.shopStatusRejected : status;

  return (
    <>
      <TopBar title={t.nav.shops} back="/admin" />

      <div className="no-sb flex flex-1 flex-col gap-[10px] overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pt-2 pb-4">
        {(shops ?? []).length === 0 ? (
          <EmptyState title={t.common.empty} />
        ) : (
          shops!.map((shop) =>
            shop.status === "pending" ? (
              <PendingShopRow
                key={shop.id}
                shop={{
                  id: shop.id,
                  name: shop.name,
                  slug: shop.slug,
                  monogram: monogram(shop.name),
                  hue: shop.category?.hue ?? 300,
                  submittedAgo: timeAgo(shop.submitted_at, locale),
                  productCount: shop.products?.length ?? 0,
                  missingDocument: shop.missing_document,
                }}
              />
            ) : (
              <Card key={shop.id} className="flex flex-none items-center gap-[10px] p-[11px]">
                <span
                  className="cat-surface cat-ink flex h-8 w-8 flex-none items-center justify-center rounded-full text-[0.6875rem] font-bold"
                  style={{ "--hue": shop.category?.hue ?? 300 } as React.CSSProperties}
                >
                  {monogram(shop.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">{shop.name}</p>
                  <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                    {shop.category?.name_fr} · {formatCount(shop.followers_count)} {t.shop.followers} ·{" "}
                    {formatRating(shop.rating_sum, shop.rating_count)} ★
                  </p>
                </div>

                <div className="flex flex-none items-center gap-2">
                  {shop.status === "rejected" && <Tag tone="live">{statusLabel(shop.status)}</Tag>}
                  <FeatureToggle shopId={shop.id} featured={shop.is_featured} />
                </div>
              </Card>
            ),
          )
        )}
      </div>
    </>
  );
}
