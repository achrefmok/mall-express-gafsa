import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatCount, monogram, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, SectionTitle, Tag } from "@/components/ui/primitives";
import { PendingShopRow, ReportRow, SteeringPanel } from "./admin-client";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Écran 14 — modération et pilotage. */
export default async function AdminDashboard() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [shopsCount, usersCount, pending, reports, categoriesCount, sponsored, alerts] =
    await Promise.all([
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),

      supabase
        .from("shops")
        .select(
          "id, name, slug, status, submitted_at, missing_document, category:categories!shops_category_id_fkey(hue), products:products(id)",
        )
        .eq("status", "pending")
        .order("submitted_at")
        .limit(20),

      supabase
        .from("reports")
        .select("id, target_type, target_id, reason, created_at, reporter:profiles!reports_reporter_id_fkey(first_name, last_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20),

      supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),

      supabase
        .from("sponsored_slots")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString()),

      supabase
        .from("city_alerts")
        .select("id, title, severity")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const pendingShops = pending.data ?? [];
  const openReports = reports.data ?? [];

  // Regroupe les signalements par cible : « signalé 3 fois » plutôt que
  // trois lignes identiques dans la file.
  const groupedReports = Object.values(
    openReports.reduce<
      Record<string, { key: string; targetType: string; targetId: string; count: number; reason: string | null; createdAt: string }>
    >((acc, report) => {
      const key = `${report.target_type}:${report.target_id}`;
      acc[key] ??= {
        key,
        targetType: report.target_type,
        targetId: report.target_id,
        count: 0,
        reason: report.reason,
        createdAt: report.created_at,
      };
      acc[key].count += 1;
      return acc;
    }, {}),
  );

  const toProcess = pendingShops.length + groupedReports.length;

  // Titres des bons plans signalés, pour que la file soit lisible.
  const dealIds = groupedReports.filter((r) => r.targetType === "deal").map((r) => r.targetId);
  const { data: reportedDeals } = dealIds.length
    ? await supabase
        .from("deals")
        .select("id, title, author:profiles!deals_author_id_fkey(first_name, last_name)")
        .in("id", dealIds)
    : { data: [] };

  const dealById = Object.fromEntries((reportedDeals ?? []).map((deal) => [deal.id, deal]));

  return (
    <>
      <TopBar
        title={t.admin.title}
        className="pb-[6px]"
        action={<Tag tone="tinted">Gafsa</Tag>}
      />

      <div className="no-sb flex flex-1 flex-col gap-[14px] overflow-y-auto px-4 pt-[10px] pb-4">
        {/* ─── Trois statistiques ───────────────────────────────────── */}
        <div className="grid flex-none grid-cols-3 gap-2">
          {[
            { value: formatCount(shopsCount.count ?? 0), label: t.admin.shopsCount, alert: false },
            { value: formatCount(usersCount.count ?? 0), label: t.admin.usersCount, alert: false },
            { value: String(toProcess), label: t.admin.toProcess, alert: toProcess > 0 },
          ].map((stat) => (
            <Card key={stat.label} className="p-[11px]">
              <p
                className={`text-[1.1875rem] font-bold ${
                  stat.alert ? "text-[var(--color-live)]" : "text-[var(--color-brand)]"
                }`}
              >
                {stat.value}
              </p>
              <p className="text-[0.59375rem] text-[var(--color-muted)]">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* ─── Boutiques à approuver ────────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.admin.pendingShops}</SectionTitle>

          {pendingShops.length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">{t.common.empty}</p>
          ) : (
            pendingShops.map((shop) => (
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
            ))
          )}
        </section>

        {/* ─── Signalements ─────────────────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.admin.reportsTitle}</SectionTitle>

          {groupedReports.length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">{t.common.empty}</p>
          ) : (
            groupedReports.map((report) => {
              const deal = dealById[report.targetId];
              return (
                <ReportRow
                  key={report.key}
                  report={{
                    targetType: report.targetType,
                    targetId: report.targetId,
                    count: report.count,
                    title: deal
                      ? format(t.admin.reportedTimes, { what: t.deals.title, n: report.count })
                      : format(t.admin.reportedTimes, { what: report.targetType, n: report.count }),
                    subtitle: deal
                      ? `« ${deal.title} » · ${deal.author?.first_name ?? ""} ${deal.author?.last_name?.[0] ?? ""}.`
                      : (report.reason ?? ""),
                  }}
                />
              );
            })
          )}
        </section>

        {/* ─── Pilotage ─────────────────────────────────────────────── */}
        <SteeringPanel
          sponsoredCount={sponsored.count ?? 0}
          categoriesCount={categoriesCount.count ?? 0}
          activeAlerts={alerts.data ?? []}
        />
      </div>
    </>
  );
}
