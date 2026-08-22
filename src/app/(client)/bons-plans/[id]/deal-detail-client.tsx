"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { reportDeal, voteDeal } from "@/app/actions/deals";
import { cx } from "@/lib/format";
import { DownIcon, UpIcon } from "@/components/ui/icons";

export function DealVoteBar({
  dealId,
  upvotes,
  downvotes,
  myVote,
  isAuthor,
  signedIn,
}: {
  dealId: string;
  upvotes: number;
  downvotes: number;
  myVote: number | null;
  isAuthor: boolean;
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [vote, setVote] = useState(myVote);
  const [up, setUp] = useState(upvotes);
  const [down, setDown] = useState(downvotes);
  const [notice, setNotice] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [, startTransition] = useTransition();

  function cast(value: 1 | -1) {
    if (!signedIn) {
      router.push(`/connexion?suite=/bons-plans/${dealId}`);
      return;
    }
    if (isAuthor) {
      setNotice(t.deals.cannotVoteOwn);
      return;
    }

    const previous = { vote, up, down };
    const nextVote = vote === value ? null : value;

    setVote(nextVote);
    setUp((n) => n - (vote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0));
    setDown((n) => n - (vote === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0));

    startTransition(async () => {
      const result = await voteDeal(dealId, value, previous.vote);
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

  return (
    <>
      {notice && (
        <p role="status" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {notice}
        </p>
      )}

      <div className="flex items-center gap-[14px] pt-1">
        <button
          type="button"
          onClick={() => cast(1)}
          aria-pressed={vote === 1}
          className={cx(
            "flex items-center gap-[5px] rounded-[12px] px-3 py-2 text-[0.6875rem] font-bold transition-colors",
            vote === 1
              ? "bg-[var(--color-brand-fill)] text-white"
              : "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
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
            "flex items-center gap-[5px] text-[0.6875rem]",
            vote === -1 ? "font-bold text-[var(--color-live)]" : "text-[var(--color-muted)]",
          )}
        >
          <DownIcon size={13} />
          {down}
        </button>

        <button
          type="button"
          disabled={reported}
          onClick={() => {
            if (!signedIn) {
              router.push(`/connexion?suite=/bons-plans/${dealId}`);
              return;
            }
            startTransition(async () => {
              await reportDeal(dealId);
              setReported(true);
            });
          }}
          className="ms-auto text-[0.65625rem] font-bold text-[var(--color-muted)] disabled:opacity-60"
        >
          {reported ? t.deals.reported : t.deals.report}
        </button>
      </div>
    </>
  );
}
