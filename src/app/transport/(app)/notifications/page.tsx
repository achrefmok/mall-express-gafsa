import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { PushToggle } from "@/components/pwa/push-toggle";
import { ListeNotificationsTransport } from "@/components/transport/liste-notifications";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/**
 * Les notifications de « Taxi & Louage Gafsa » : seulement celles des
 * courses — demandes, acceptations, refus (`taxi_request`) et messages
 * échangés avec le chauffeur (`new_message` dont le lien mène au taxi).
 * Les notifications de G-Mall (commandes, directs…) restent dans G-Mall.
 * Les notifications push sont déjà réservées aux courses côté serveur.
 */
export default async function NotificationsTransport() {
  const { locale } = await getT();
  const ar = locale === "ar";
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", profile.id)
    .in("kind", ["taxi_request", "new_message"])
    .order("created_at", { ascending: false })
    .limit(60);

  const courses = (data ?? []).filter((n) => n.kind === "taxi_request" || (n.link ?? "").startsWith("/taxi"));

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <h1 className="text-[1.5rem] font-black tracking-[-0.4px]">{ar ? "الإشعارات" : "Notifications"}</h1>
      <div className="rounded-[18px] bg-[var(--color-surface-solid)] p-3">
        <p className="mb-2 text-[0.75rem] text-[var(--color-muted)]">
          {ar ? "فعّل الإشعارات ليصلك قبول رحلتك حتى والتطبيق مغلق." : "Activez les notifications pour savoir qu’un chauffeur a accepté, même application fermée."}
        </p>
        <PushToggle />
      </div>
      <ListeNotificationsTransport notifications={courses} locale={locale} />
    </div>
  );
}
