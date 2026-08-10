"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Explique la redirection posée par le middleware.
 *
 * Un compte sans le rôle requis pour `/vendeur` ou `/admin` est renvoyé à
 * l'accueil avec `?acces=refuse`. Sans ce bandeau, la redirection est muette :
 * on clique, on se retrouve sur l'accueil, et rien ne dit pourquoi.
 */
export function AccessNotice() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || params.get("acces") !== "refuse") return null;

  return (
    <div
      role="status"
      className="flex flex-none items-center gap-2 border-b border-[rgba(122,31,43,0.15)] bg-[var(--color-brand-tint)] px-4 py-[7px]"
    >
      <p className="flex-1 text-[10.5px] leading-[1.4] font-semibold text-[var(--color-ink)]">
        {t.common.accessDenied}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t.common.close}
        className="flex-none px-1 text-[13px] leading-none text-[var(--color-muted)]"
      >
        ×
      </button>
    </div>
  );
}
