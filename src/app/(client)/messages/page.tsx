import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { monogram, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Avatar, Card, EmptyState, ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/messages");

  const { t, locale } = await getT();
  const supabase = await createClient();

  /*
   * Un vendeur voit les conversations de sa boutique, un client les siennes.
   * Les policies RLS couvrent déjà les deux cas : on interroge sans filtre
   * sur l'utilisateur et on laisse la base décider de ce qui est visible.
   */
  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      `id, last_message_at, user_id,
       shop:shops(id, name, slug, logo_url),
       client:profiles(first_name, last_name, avatar_url),
       messages(id, body, created_at, sender_id, read_at)`,
    )
    .order("last_message_at", { ascending: false })
    .limit(50);

  const rows = conversations ?? [];

  return (
    <>
      <TopBar title={t.account.messages} back="/profil" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-2 overflow-y-auto px-4 pt-2 pb-4">
        {rows.length === 0 ? (
          <EmptyState
            title={t.common.empty}
            body="Écrivez à une boutique depuis sa fiche pour démarrer une conversation."
            action={
              <ButtonLink href="/marketplace" size="sm" className="mt-1">
                {t.nav.marketplace}
              </ButtonLink>
            }
          />
        ) : (
          rows.map((conversation) => {
            // La jointure ne trie pas : on prend le message le plus récent.
            const messages = conversation.messages ?? [];
            const last = messages.reduce<(typeof messages)[number] | null>(
              (newest, message) =>
                !newest || message.created_at > newest.created_at ? message : newest,
              null,
            );

            const unread = messages.filter(
              (message) => message.sender_id !== profile.id && !message.read_at,
            ).length;

            // Côté client on affiche la boutique ; côté vendeur, le client.
            const iAmTheClient = conversation.user_id === profile.id;
            const label = iAmTheClient
              ? (conversation.shop?.name ?? "—")
              : [conversation.client?.first_name, conversation.client?.last_name]
                  .filter(Boolean)
                  .join(" ") || "—";
            const avatar = iAmTheClient
              ? conversation.shop?.logo_url
              : conversation.client?.avatar_url;

            return (
              <Link key={conversation.id} href={`/messages/${conversation.id}`}>
                <Card className="flex items-center gap-[10px] p-3">
                  <Avatar src={avatar} initials={monogram(label)} size={38} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-[var(--color-ink)]">{label}</p>
                    <p className="truncate text-[10.5px] text-[var(--color-muted)]">
                      {last?.body ?? "—"}
                    </p>
                  </div>

                  <div className="flex flex-none flex-col items-end gap-1">
                    <span className="text-[9.5px] text-[var(--color-faint)]">
                      {timeAgo(conversation.last_message_at, locale)}
                    </span>
                    {unread > 0 && (
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-live)] px-[5px] text-[9px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
