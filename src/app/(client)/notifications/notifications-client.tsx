"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/account";
import { cx, timeAgo } from "@/lib/format";
import { Card } from "@/components/ui/primitives";
import type { AppLocale, Notification, NotificationKind } from "@/types/database";

/** Une teinte de catégorie par type de notification, règle systémique oblige. */
const HUE: Record<NotificationKind, number> = {
  order_update: 255,
  live_starting: 10,
  deal_verified: 155,
  shop_approved: 110,
  shop_rejected: 25,
  new_message: 215,
  loyalty: 45,
  city_alert: 350,
  referral: 70,
  taxi_request: 195,
};

const MONOGRAM: Record<NotificationKind, string> = {
  order_update: "CM",
  live_starting: "LV",
  deal_verified: "BP",
  shop_approved: "OK",
  shop_rejected: "!",
  new_message: "MS",
  loyalty: "PT",
  city_alert: "!",
  referral: "+2",
  taxi_request: "TX",
};

export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
      className="text-[0.71875rem] font-bold text-[var(--color-brand)] disabled:opacity-50"
    >
      Tout marquer lu ({count})
    </button>
  );
}

export function NotificationRow({
  notification,
  locale,
}: {
  notification: Notification;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [read, setRead] = useState(Boolean(notification.read_at));
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (removed) return null;

  function open() {
    if (!read) {
      setRead(true);
      startTransition(async () => {
        await markNotificationRead(notification.id);
      });
    }
    if (notification.link) router.push(notification.link);
  }

  return (
    <Card
      className={cx(
        "flex flex-none items-start gap-[10px] p-3 transition-opacity",
        read && "opacity-65",
      )}
    >
      <span
        className="cat-surface cat-ink flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[0.75rem] font-bold"
        style={{ "--hue": HUE[notification.kind] } as React.CSSProperties}
        aria-hidden
      >
        {MONOGRAM[notification.kind]}
      </span>

      <button type="button" onClick={open} className="min-w-0 flex-1 text-start">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
            {notification.title}
          </span>
          {!read && (
            <span className="h-[7px] w-[7px] flex-none rounded-full bg-[var(--color-live-fill)]" aria-label="non lu" />
          )}
        </span>
        {notification.body && (
          <span className="mt-[2px] block text-[0.65625rem] leading-[1.45] text-[var(--color-muted)]">
            {notification.body}
          </span>
        )}
        <span className="mt-1 block text-[0.59375rem] text-[var(--color-faint)]">
          {timeAgo(notification.created_at, locale)}
        </span>
      </button>

      <button
        type="button"
        disabled={pending}
        aria-label={t.common.delete}
        onClick={() => {
          setRemoved(true);
          startTransition(async () => {
            const result = await deleteNotification(notification.id);
            if (!result.ok) setRemoved(false);
          });
        }}
        className="flex-none p-1 text-[0.75rem] text-[var(--color-faint)]"
      >
        ✕
      </button>
    </Card>
  );
}
