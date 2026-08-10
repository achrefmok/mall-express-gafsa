"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile } from "./_helpers";
import type { Database, ServiceRequestKind } from "@/types/database";

/* ─── Profil ───────────────────────────────────────────────────────────── */

export async function updateProfile(input: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  bio?: string;
  avatarUrl?: string | null;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (input.firstName !== undefined && !input.firstName.trim()) {
    return fail("Le prénom est obligatoire");
  }

  // `role`, `loyalty_points` et `is_banned` sont neutralisés par le trigger
  // guard_profile_privileges : on ne les transmet pas non plus.
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
  if (input.lastName !== undefined) patch.last_name = input.lastName.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.city !== undefined) patch.city = input.city.trim() || null;
  if (input.bio !== undefined) patch.bio = input.bio.trim() || null;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  if (Object.keys(patch).length === 0) return done();

  const { error: e } = await supabase.from("profiles").update(patch).eq("id", profile.id);
  if (e) return fail(readableError(e));

  revalidatePath("/profil");
  return done();
}

/* ─── Notifications ────────────────────────────────────────────────────── */

export async function markNotificationRead(notificationId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  if (e) return fail(readableError(e));

  revalidatePath("/notifications");
  return done();
}

export async function markAllNotificationsRead() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (e) return fail(readableError(e));

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return done();
}

export async function deleteNotification(notificationId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  if (e) return fail(readableError(e));

  revalidatePath("/notifications");
  return done();
}

/* ─── Messagerie ───────────────────────────────────────────────────────── */

/** Ouvre la conversation avec une boutique, ou la crée si elle n'existe pas. */
export async function openConversation(shopId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .match({ user_id: profile.id, shop_id: shopId })
    .maybeSingle();

  if (existing) return ok({ id: existing.id });

  const { data, error: e } = await supabase
    .from("conversations")
    .insert({ user_id: profile.id, shop_id: shopId })
    .select("id")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/messages");
  return ok({ id: data.id });
}

export async function sendMessage(conversationId: string, body: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const text = body.trim();
  if (!text) return fail("Message vide");
  if (text.length > 2000) return fail("Message trop long");

  const { error: e } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: profile.id, body: text });

  if (e) return fail(readableError(e));

  // Remonte la conversation en tête de liste des deux côtés.
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return done();
}

export async function markConversationRead(conversationId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", profile.id)
    .is("read_at", null);

  if (e) return fail(readableError(e));
  return done();
}

/* ─── Démarches administratives ────────────────────────────────────────── */

export async function submitServiceRequest(input: {
  kind: ServiceRequestKind;
  title: string;
  body?: string;
  attachments?: string[];
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const title = input.title.trim();
  if (title.length < 3) return fail("Précisez l'objet de votre démarche");

  const { data, error: e } = await supabase
    .from("service_requests")
    .insert({
      user_id: profile.id,
      kind: input.kind,
      title,
      body: input.body?.trim() || null,
      attachments: input.attachments ?? [],
    })
    .select("id")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/profil/demarches");
  return ok({ id: data.id });
}
