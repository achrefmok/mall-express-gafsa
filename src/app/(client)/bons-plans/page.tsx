import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Avatar, EmptyState, Fab, Rail } from "@/components/ui/primitives";
import { DotsIcon } from "@/components/ui/icons";
import { DealCard, DealFilters } from "./deals-client";

export const metadata: Metadata = {
  title: "Bons plans de Gafsa — partagés par les habitants",
  description:
    "Les bons plans repérés en ville par la communauté : promotions, offres non affichées, réductions du jour. Confirmés par trois membres.",
  alternates: { canonical: "/bons-plans" },
};

export const dynamic = "force-dynamic";

type Tab = "popular" | "recent" | "nearby" | "expiring";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tri?: string }>;
}) {
  const { tri } = await searchParams;
  const tab = (["popular", "recent", "nearby", "expiring"] as const).includes(tri as Tab)
    ? (tri as Tab)
    : "popular";

  const { t, locale } = await getT();
  const profile = await getProfile();
  const supabase = await createClient();

  let query = supabase
    .from("deals")
    .select(
      `id, title, body, body_ar, images, location_label, expires_at, is_verified,
       upvotes, downvotes, comments_count, created_at,
       author:profiles!deals_author_id_fkey(id, first_name, last_name, avatar_url),
       shop:shops(name, slug),
       category:categories(hue, name_fr, name_ar)`,
    )
    .eq("status", "active")
    .limit(25);

  switch (tab) {
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "expiring": {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("expires_at", endOfDay.toISOString()).order("expires_at");
      break;
    }
    case "nearby":
      // Sans géolocalisation, « près de moi » se lit : rattaché à une
      // boutique du mall, donc localisable physiquement.
      query = query.not("shop_id", "is", null).order("created_at", { ascending: false });
      break;
    default:
      query = query.order("upvotes", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data: deals } = await query;

  // Votes de l'utilisateur, pour afficher l'état des boutons.
  let myVotes: Record<string, number> = {};
  if (profile && (deals ?? []).length > 0) {
    const { data } = await supabase
      .from("deal_votes")
      .select("deal_id, value")
      .eq("user_id", profile.id)
      .in(
        "deal_id",
        deals!.map((d) => d.id),
      );

    myVotes = Object.fromEntries((data ?? []).map((v) => [v.deal_id, v.value]));
  }

  return (
    <>
      <TopBar
        title={t.deals.title}
        className="pb-[6px]"
        action={
          <span className="text-[var(--color-ink)]" aria-hidden>
            <DotsIcon size={14} />
          </span>
        }
      />

      <DealFilters active={tab} />

      {/* ─── Composeur ─────────────────────────────────────────────────── */}
      <div className="flex-none px-4 pb-3">
        <Link
          href="/bons-plans/nouveau"
          className="flex items-center gap-[10px] rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[11px_12px] shadow-[var(--shadow-card)]"
        >
          <Avatar
            src={profile?.avatar_url}
            initials={monogram(profile?.first_name, profile?.last_name) || "··"}
            size={32}
            tone="ink"
          />
          <span className="min-w-0 flex-1 truncate text-[0.71875rem] text-[var(--color-muted)]">
            {t.deals.composer}
          </span>
          <Rail className="flex-none" gap={6}>
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.6875rem] font-bold text-[var(--color-brand)]">
              PH
            </span>
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.6875rem] font-bold text-[var(--color-brand)]">
              ST
            </span>
          </Rail>
        </Link>
      </div>

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pb-[82px]">
        {(deals ?? []).length === 0 ? (
          <EmptyState title={t.common.empty} body={t.deals.composer} />
        ) : (
          deals!.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              locale={locale}
              myVote={myVotes[deal.id] ?? null}
              isAuthor={profile?.id === deal.author?.id}
              signedIn={Boolean(profile)}
            />
          ))
        )}
      </div>

      <Fab href="/bons-plans/nouveau">+ {t.deals.newDeal}</Fab>
    </>
  );
}
