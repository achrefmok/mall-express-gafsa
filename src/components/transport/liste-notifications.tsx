"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/account";
import type { AppLocale } from "@/types/database";

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Liste des notifications de course : toucher marque comme lue puis ouvre la course. */
export function ListeNotificationsTransport({ notifications, locale }: { notifications: Notif[]; locale: AppLocale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  const nonLues = notifications.filter((n) => !n.read_at).length;

  if (notifications.length === 0) {
    return (
      <p className="rounded-[18px] border border-dashed border-[var(--color-outline)] p-6 text-center text-[0.875rem] text-[var(--color-muted)]">
        {ar ? "لا إشعارات بعد. ستظهر هنا أخبار رحلاتك." : "Aucune notification pour l’instant. Les nouvelles de vos courses s’afficheront ici."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {nonLues > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await markAllNotificationsRead(), router.refresh()))}
          className="self-end text-[0.75rem] font-extrabold text-[var(--color-brand)] disabled:opacity-50"
        >
          {ar ? "تعليم الكلّ كمقروء" : "Tout marquer comme lu"}
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  if (!n.read_at) await markNotificationRead(n.id);
                  router.push(n.link && n.link.startsWith("/") ? n.link : "/courses");
                })
              }
              className="press flex w-full items-start gap-3 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3 text-start"
            >
              <span
                aria-hidden
                className="mt-[6px] h-[10px] w-[10px] flex-none rounded-full"
                style={{ background: n.read_at ? "transparent" : "var(--color-brand)", boxShadow: "inset 0 0 0 1.5px var(--color-brand)" }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <b className={`text-[0.875rem] ${n.read_at ? "font-semibold text-[var(--color-muted)]" : ""}`}>{n.title}</b>
                {n.body && <span className="line-clamp-2 text-[0.78125rem] text-[var(--color-muted)]">{n.body}</span>}
                <span className="text-[0.6875rem] text-[var(--color-faint)]">
                  {new Date(n.created_at).toLocaleString(ar ? "ar-TN" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
