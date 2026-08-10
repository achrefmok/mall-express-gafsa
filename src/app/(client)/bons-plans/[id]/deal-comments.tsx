"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { commentDeal } from "@/app/actions/deals";
import { monogram, shortName, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

export function DealComments({
  dealId,
  initialComments,
  signedIn,
  locale,
}: {
  dealId: string;
  initialComments: Comment[];
  signedIn: boolean;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!signedIn) {
      router.push(`/connexion?suite=/bons-plans/${dealId}`);
      return;
    }

    const body = draft.trim();
    if (!body) return;

    setDraft("");
    setError(null);

    startTransition(async () => {
      const result = await commentDeal(dealId, body);
      if (result.ok) router.refresh();
      else {
        setDraft(body);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {initialComments.length === 0 && (
        <p className="text-[11px] text-[var(--color-muted)]">{t.common.empty}</p>
      )}

      {initialComments.map((comment) => (
        <div key={comment.id} className="flex gap-[9px]">
          <Avatar
            src={comment.author?.avatar_url}
            initials={monogram(comment.author?.first_name, comment.author?.last_name)}
            size={28}
          />
          <div className="min-w-0 flex-1 rounded-[14px] bg-[var(--color-surface)] px-3 py-2">
            <p className="text-[11px] font-bold text-[var(--color-ink)]">
              {shortName(comment.author) || "—"}
              <span className="ms-2 font-normal text-[var(--color-faint)]">
                {timeAgo(comment.created_at, locale)}
              </span>
            </p>
            <p className="mt-[2px] text-[11.5px] leading-[1.5] text-[var(--color-muted)]">
              {comment.body}
            </p>
          </div>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder={t.live.writeComment}
          aria-label={t.live.writeComment}
          className="min-w-0 flex-1 rounded-[16px] border border-[var(--color-outline)] bg-white px-3 py-[10px] text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="flex-none rounded-[16px] bg-[var(--color-brand)] px-4 py-[10px] text-[11px] font-bold text-white disabled:opacity-40"
        >
          {t.live.send}
        </button>
      </form>
    </div>
  );
}
