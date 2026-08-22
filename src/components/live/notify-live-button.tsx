"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { followShopOfLive } from "@/app/actions/lives";

/**
 * « Me prévenir » : suivre la boutique du prochain direct. Le trigger
 * start_live notifie ensuite tous les abonnés.
 */
export function NotifyLiveButton({ liveId }: { liveId: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={done || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await followShopOfLive(liveId);
          if (result.ok) setDone(true);
        })
      }
      className="flex-none whitespace-nowrap rounded-[12px] bg-[var(--color-brand-tint)] px-[10px] py-[5px] text-[0.625rem] font-bold text-[var(--color-brand)] disabled:opacity-70"
    >
      {done ? t.home.notified : t.home.notifyMe}
    </button>
  );
}
