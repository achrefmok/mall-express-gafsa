import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { MarkAllRead, NotificationRow } from "./notifications-client";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/notifications");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = notifications ?? [];
  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <>
      <TopBar
        title="Notifications"
        back="/"
        action={unread > 0 ? <MarkAllRead count={unread} /> : undefined}
      />

      <div className="no-sb flex flex-1 flex-col gap-2 overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pt-2 pb-4">
        {rows.length === 0 ? (
          <EmptyState
            title={t.common.empty}
            body="Vous serez prévenu ici des directs, des commandes et des bons plans vérifiés."
          />
        ) : (
          rows.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} locale={locale} />
          ))
        )}
      </div>
    </>
  );
}
