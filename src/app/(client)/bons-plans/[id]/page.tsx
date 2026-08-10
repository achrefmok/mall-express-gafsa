import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/dictionaries";
import { formatDateTime, monogram, shortName, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Avatar, Card, Divider, Tag } from "@/components/ui/primitives";
import { DealVoteBar } from "./deal-detail-client";
import { DealComments } from "./deal-comments";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("deals").select("title, body").eq("id", id).maybeSingle();

  if (!data) return { title: "Bon plan introuvable" };

  return {
    title: data.title,
    description: data.body ?? undefined,
    alternates: { canonical: `/bons-plans/${id}` },
  };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getT();

  const profile = await getProfile();
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      `id, title, body, body_ar, images, location_label, expires_at, status,
       is_verified, upvotes, downvotes, comments_count, created_at,
       author:profiles!deals_author_id_fkey(id, first_name, last_name, avatar_url),
       shop:shops(name, slug),
       category:categories(hue, name_fr, name_ar)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!deal) notFound();

  const [comments, myVote] = await Promise.all([
    supabase
      .from("deal_comments")
      .select("id, body, created_at, author:profiles(first_name, last_name, avatar_url)")
      .eq("deal_id", id)
      .eq("is_hidden", false)
      .order("created_at")
      .limit(100),

    profile
      ? supabase
          .from("deal_votes")
          .select("value")
          .match({ deal_id: id, user_id: profile.id })
          .maybeSingle()
          .then(({ data }) => data?.value ?? null)
      : Promise.resolve(null),
  ]);

  const body = locale === "ar" && deal.body_ar ? deal.body_ar : deal.body;
  const expired = deal.status !== "active" || new Date(deal.expires_at).getTime() <= Date.now();

  return (
    <>
      <TopBar title={t.deals.title} back="/bons-plans" />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <Card className="flex flex-none flex-col overflow-hidden p-0">
          <header className="flex items-center gap-[9px] p-[11px_12px]">
            <Avatar
              src={deal.author?.avatar_url}
              initials={monogram(deal.author?.first_name, deal.author?.last_name)}
              size={32}
              hue={deal.category?.hue ?? 300}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-[var(--color-ink)]">
                {shortName(deal.author) || "—"}
              </p>
              <p className="truncate text-[10px] text-[var(--color-muted)]">
                {timeAgo(deal.created_at, locale)}
                {deal.location_label && ` · ${deal.location_label}`}
              </p>
            </div>

            {deal.is_verified ? (
              <Tag tone="tinted">{t.deals.verified}</Tag>
            ) : expired ? (
              <Tag tone="outline">{t.deals.expired}</Tag>
            ) : null}
          </header>

          {deal.images?.[0] && (
            <Image
              src={deal.images[0]}
              alt=""
              width={520}
              height={220}
              className="h-[220px] w-full object-cover"
            />
          )}

          <div className="flex flex-col gap-2 p-[12px]">
            <h1 className="text-[15px] font-bold leading-[1.35] text-[var(--color-ink)]">
              {deal.title}
            </h1>

            {body && (
              <p
                lang={locale === "ar" && deal.body_ar ? "ar" : undefined}
                dir={locale === "ar" && deal.body_ar ? "rtl" : undefined}
                className="text-[12px] leading-[1.55] text-[var(--color-muted)]"
              >
                {body}
              </p>
            )}

            {deal.shop && (
              <Link
                href={`/boutique/${deal.shop.slug}`}
                className="text-[11.5px] font-semibold text-[var(--color-brand)]"
              >
                {deal.shop.name} →
              </Link>
            )}

            <Divider />

            <p className="text-[10.5px] text-[var(--color-muted)]">
              {t.deals.validUntil} {formatDateTime(deal.expires_at, locale)}
            </p>

            <DealVoteBar
              dealId={deal.id}
              upvotes={deal.upvotes}
              downvotes={deal.downvotes}
              myVote={myVote}
              isAuthor={profile?.id === deal.author?.id}
              signedIn={Boolean(profile)}
            />
          </div>
        </Card>

        {!deal.is_verified && !expired && (
          <div className="flex flex-none items-center gap-[10px] rounded-[18px] bg-[var(--color-brand-tint)] p-[11px_12px]">
            <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[var(--color-brand)] text-[12px] font-bold text-white">
              i
            </span>
            <p className="text-[10.5px] leading-[1.45] text-[var(--color-ink)]">{t.deals.hint}</p>
          </div>
        )}

        <h2 className="text-[11px] font-bold tracking-[0.2px] text-[var(--color-ink)]">
          {format(t.deals.commentsCount, { n: deal.comments_count })}
        </h2>

        <DealComments
          dealId={deal.id}
          initialComments={comments.data ?? []}
          signedIn={Boolean(profile)}
          locale={locale}
        />
      </div>
    </>
  );
}
