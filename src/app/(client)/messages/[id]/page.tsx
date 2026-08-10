import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { MessageThread } from "./thread";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) redirect(`/connexion?suite=/messages/${id}`);

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      `id, user_id, shop_id,
       shop:shops(id, name, slug, logo_url),
       client:profiles(first_name, last_name, avatar_url)`,
    )
    .eq("id", id)
    .maybeSingle();

  // RLS renvoie simplement zéro ligne si la conversation n'est pas la nôtre :
  // pas besoin de vérifier l'appartenance ici.
  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, read_at")
    .eq("conversation_id", id)
    .order("created_at")
    .limit(200);

  const iAmTheClient = conversation.user_id === profile.id;
  const title = iAmTheClient
    ? (conversation.shop?.name ?? "—")
    : [conversation.client?.first_name, conversation.client?.last_name].filter(Boolean).join(" ") ||
      "—";

  return (
    <MessageThread
      conversationId={id}
      title={title}
      shopSlug={iAmTheClient ? (conversation.shop?.slug ?? null) : null}
      meId={profile.id}
      initialMessages={messages ?? []}
    />
  );
}
