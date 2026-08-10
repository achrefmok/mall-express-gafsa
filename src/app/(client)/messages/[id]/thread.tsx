"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead, sendMessage } from "@/app/actions/account";
import { cx } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { StoreIcon } from "@/components/ui/icons";

interface Message {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
}

/** Fil de conversation, mis à jour en direct par Postgres Changes. */
export function MessageThread({
  conversationId,
  title,
  shopSlug,
  meId,
  initialMessages,
}: {
  conversationId: string;
  title: string;
  shopSlug: string | null;
  meId: string;
  initialMessages: Message[];
}) {
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const endRef = useRef<HTMLDivElement>(null);

  /* Marquer lu à l'ouverture, puis à chaque message reçu. */
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId, messages.length]);

  /* Réception temps réel. */
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          const incoming = row as Message;
          setMessages((current) =>
            current.some((m) => m.id === incoming.id) ? current : [...current, incoming],
          );
        },
      );

    void channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  function onSend(event: React.FormEvent) {
    event.preventDefault();

    const body = draft.trim();
    if (!body) return;

    setDraft("");
    setError(null);

    startTransition(async () => {
      const result = await sendMessage(conversationId, body);
      if (!result.ok) {
        setDraft(body);
        setError(result.error);
      }
      // Pas d'ajout optimiste : le canal Realtime renvoie le message inséré,
      // et l'insérer deux fois obligerait à réconcilier des identifiants
      // temporaires pour un gain imperceptible en local.
    });
  }

  return (
    <>
      <TopBar
        title={title}
        back="/messages"
        action={
          shopSlug ? (
            <Link
              href={`/boutique/${shopSlug}`}
              aria-label={t.product.seeShop}
              className="text-[var(--color-ink)]"
            >
              <StoreIcon />
            </Link>
          ) : undefined
        }
      />

      <div className="col-reading no-sb flex flex-1 flex-col gap-2 overflow-y-auto px-4 pt-2 pb-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-[11.5px] text-[var(--color-muted)]">
            {t.common.empty}
          </p>
        )}

        {messages.map((message) => {
          const mine = message.sender_id === meId;
          return (
            <div
              key={message.id}
              className={cx(
                "max-w-[78%] rounded-[16px] px-3 py-2 text-[12px] leading-[1.45]",
                mine
                  ? "self-end bg-[var(--color-brand)] text-white"
                  : "self-start border border-[var(--color-surface-edge)] bg-[var(--color-surface)] text-[var(--color-ink)]",
              )}
            >
              {message.body}
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="px-4 pb-1 text-[11px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <form
        onSubmit={onSend}
        className="flex flex-none items-center gap-2 border-t border-[var(--color-hairline)] px-4 py-3"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
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
    </>
  );
}
