"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { signOut } from "@/app/actions/auth";

export function InviteButton({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function onInvite() {
    const url = `${window.location.origin}/inscription?parrain=${encodeURIComponent(code)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: t.account.referTitle, url });
        return;
      } catch {
        // Partage annulé : on retombe sur la copie.
      }
    }

    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  }

  return (
    <button
      type="button"
      onClick={onInvite}
      disabled={!code}
      className="flex-none whitespace-nowrap rounded-[12px] bg-[var(--color-brand)] px-[11px] py-[6px] text-[10px] font-bold text-white disabled:opacity-50"
    >
      {copied ? t.account.inviteCopied : t.account.invite}
    </button>
  );
}

export function SignOutButton() {
  const { t } = useI18n();

  return (
    <form action={signOut} className="pt-2">
      <button
        type="submit"
        className="w-full rounded-[18px] border border-[var(--color-outline)] py-3 text-[12px] font-semibold text-[var(--color-live)]"
      >
        {t.account.signOut}
      </button>
    </form>
  );
}
