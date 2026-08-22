import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { shortName, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { ReportRow } from "../admin-client";

export const metadata: Metadata = {
  title: "Signalements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, created_at, reporter:profiles!reports_reporter_id_fkey(first_name, last_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = reports ?? [];

  const grouped = Object.values(
    rows.reduce<
      Record<
        string,
        { key: string; targetType: string; targetId: string; count: number; reasons: string[]; createdAt: string }
      >
    >((acc, report) => {
      const key = `${report.target_type}:${report.target_id}`;
      acc[key] ??= {
        key,
        targetType: report.target_type,
        targetId: report.target_id,
        count: 0,
        reasons: [],
        createdAt: report.created_at,
      };
      acc[key].count += 1;
      if (report.reason) acc[key].reasons.push(report.reason);
      return acc;
    }, {}),
  );

  const dealIds = grouped.filter((g) => g.targetType === "deal").map((g) => g.targetId);
  const { data: deals } = dealIds.length
    ? await supabase
        .from("deals")
        .select("id, title, author:profiles!deals_author_id_fkey(first_name, last_name)")
        .in("id", dealIds)
    : { data: [] };

  const dealById = Object.fromEntries((deals ?? []).map((deal) => [deal.id, deal]));

  return (
    <>
      <TopBar title={t.admin.reportsTitle} back="/admin" />

      <div className="no-sb flex flex-1 flex-col gap-[10px] overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pt-2 pb-4">
        {grouped.length === 0 ? (
          <EmptyState title={t.common.empty} body="Aucun contenu signalé en attente." />
        ) : (
          grouped.map((group) => {
            const deal = dealById[group.targetId];
            return (
              <ReportRow
                key={group.key}
                report={{
                  targetType: group.targetType,
                  targetId: group.targetId,
                  count: group.count,
                  title: format(t.admin.reportedTimes, {
                    what: group.targetType === "deal" ? t.deals.title : group.targetType,
                    n: group.count,
                  }),
                  subtitle: deal
                    ? `« ${deal.title} » · ${shortName(deal.author)} · ${timeAgo(group.createdAt, locale)}`
                    : group.reasons.join(" · ") || timeAgo(group.createdAt, locale),
                }}
              />
            );
          })
        )}
      </div>
    </>
  );
}
