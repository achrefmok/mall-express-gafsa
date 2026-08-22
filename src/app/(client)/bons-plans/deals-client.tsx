"use client";

import Link from "next/link";
import Image from "next/image";
import { ImageZoom } from "@/components/ui/image-zoom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { reportDeal, voteDeal } from "@/app/actions/deals";
import { cx, monogram, shortName, timeAgo } from "@/lib/format";
import { Avatar, Chip, Rail, Tag } from "@/components/ui/primitives";
import { DownIcon, UpIcon } from "@/components/ui/icons";
import type { AppLocale } from "@/types/database";

export function DealFilters({ active }: { active: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tabs = [
    { key: "popular", label: t.deals.tabs.popular },
    { key: "recent", label: t.deals.tabs.recent },
    { key: "nearby", label: t.deals.tabs.nearby },
    { key: "expiring", label: t.deals.tabs.expiring },
  ];

  function select(key: string) {
    const next = new URLSearchParams(params);
    next.set("tri", key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <Rail className="flex-none px-4 pt-[2px] pb-[10px]" gap={8}>
      {tabs.map((tab) => (
        <Chip
          key={tab.key}
          tone={tab.key === "recent" ? "tinted" : "outline"}
          active={active === tab.key}
          onClick={() => select(tab.key)}
        >
          {tab.label}
        </Chip>
      ))}
    </Rail>
  );
}

export interface DealCardData {
  id: string;
  title: string;
  body: string | null;
  body_ar: string | null;
  images: string[];
  location_label: string | null;
  expires_at: string;
  is_verified: boolean;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  author: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  shop: { name: string; slug: string } | null;
  category: { hue: number; name_fr: string; name_ar: string } | null;
}

/** Le bon plan expire-t-il avant la fin de la journée ? */
function expiresTonight(iso: string): boolean {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const expiry = new Date(iso).getTime();
  return expiry > Date.now() && expiry <= end.getTime();
}

export function DealCard({
  deal,
  locale,
  myVote,
  isAuthor,
  signedIn,
}: {
  deal: DealCardData;
  locale: AppLocale;
  myVote: number | null;
  isAuthor: boolean;
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [vote, setVote] = useState(myVote);
  const [up, setUp] = useState(deal.upvotes);
  const [down, setDown] = useState(deal.downvotes);
  const [notice, setNotice] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [, startTransition] = useTransition();

  function cast(value: 1 | -1) {
    if (!signedIn) {
      router.push("/connexion?suite=/bons-plans");
      return;
    }
    if (isAuthor) {
      setNotice(t.deals.cannotVoteOwn);
      return;
    }

    const previous = { vote, up, down };

    // Application optimiste : un vote doit répondre immédiatement.
    const removing = vote === value;
    const nextVote = removing ? null : value;
    setVote(nextVote);
    setUp((n) => n - (vote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0));
    setDown((n) => n - (vote === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0));

    startTransition(async () => {
      const result = await voteDeal(deal.id, value, previous.vote);
      if (!result.ok) {
        setVote(previous.vote);
        setUp(previous.up);
        setDown(previous.down);
        setNotice(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function onReport() {
    if (!signedIn) {
      router.push("/connexion?suite=/bons-plans");
      return;
    }
    startTransition(async () => {
      await reportDeal(deal.id);
      setReported(true);
    });
  }

  const body = locale === "ar" && deal.body_ar ? deal.body_ar : deal.body;
  const tonight = expiresTonight(deal.expires_at);

  return (
    <article className="flex-none overflow-hidden rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-[9px] p-[11px_12px]">
        <Avatar
          src={deal.author?.avatar_url}
          initials={monogram(deal.author?.first_name, deal.author?.last_name)}
          size={28}
          hue={deal.category?.hue ?? 300}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
            {shortName(deal.author) || "—"}
          </p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {timeAgo(deal.created_at, locale)}
            {deal.location_label && ` · ${deal.location_label}`}
            {!deal.location_label && deal.shop && ` · ${deal.shop.name}`}
          </p>
        </div>

        {deal.is_verified ? (
          <Tag tone="tinted">{t.deals.verified}</Tag>
        ) : tonight ? (
          <Tag tone="live">{t.deals.expiresTonight}</Tag>
        ) : null}
      </header>

      {deal.images?.[0] && (
        /*
          La photo est la preuve du bon plan : l'étiquette de prix, le rayon,
          la date de péremption. C'est précisément ce qu'on ne lit pas sur une
          image de 150 pixels de haut.
        */
        <ImageZoom
          images={deal.images}
          alt={deal.title}
          className="block w-full cursor-zoom-in"
        >
          <Image
            src={deal.images[0]}
            alt=""
            width={520}
            height={150}
            className="h-[150px] w-full object-cover"
          />
        </ImageZoom>
      )}

      <div className="flex flex-col gap-2 p-[11px_12px]">
        <h3 className="text-[0.78125rem] font-bold leading-[1.4] text-[var(--color-ink)]">{deal.title}</h3>

        {body && (
          <p
            lang={locale === "ar" && deal.body_ar ? "ar" : undefined}
            dir={locale === "ar" && deal.body_ar ? "rtl" : undefined}
            className="text-[0.6875rem] leading-[1.5] text-[var(--color-muted)]"
          >
            {body}
          </p>
        )}

        {notice && (
          <p role="status" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
            {notice}
          </p>
        )}

        <div className="flex items-center gap-[14px] pt-[2px]">
          <button
            type="button"
            onClick={() => cast(1)}
            aria-pressed={vote === 1}
            className={cx(
              "flex items-center gap-[5px] text-[0.65625rem] font-bold",
              vote === 1 ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]",
            )}
          >
            <UpIcon size={13} />
            {t.deals.worksLabel} · {up}
          </button>

          <button
            type="button"
            onClick={() => cast(-1)}
            aria-pressed={vote === -1}
            aria-label={`${t.deals.worksLabel} — non`}
            className={cx(
              "flex items-center gap-[5px] text-[0.65625rem]",
              vote === -1 ? "font-bold text-[var(--color-live)]" : "text-[var(--color-muted)]",
            )}
          >
            <DownIcon size={13} />
            {down}
          </button>

          <Link href={`/bons-plans/${deal.id}`} className="text-[0.65625rem] text-[var(--color-muted)]">
            {format(t.deals.commentsCount, { n: deal.comments_count })}
          </Link>

          <button
            type="button"
            onClick={onReport}
            disabled={reported}
            className="ms-auto text-[0.65625rem] font-bold text-[var(--color-muted)] disabled:opacity-60"
          >
            {reported ? t.deals.reported : t.deals.report}
          </button>
        </div>
      </div>
    </article>
  );
}
