"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { InstallGuide } from "@/components/pwa/install-guide";

/**
 * Le message de bienvenue d'un commerçant qui vient de s'inscrire.
 *
 * L'inscription redirige vers `/vendeur?bienvenue=1`. Le paramètre est lu puis
 * retiré de l'adresse : recharger la page, ou partager le lien, ne doit pas
 * rouvrir un accueil destiné à une seule arrivée.
 */
export function VendorWelcome() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("bienvenue") !== "1") return;

    url.searchParams.delete("bienvenue");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.vendorWelcome.title}
      className="fixed inset-0 z-[80] flex items-end justify-center"
    >
      <div className="absolute inset-0 bg-[rgba(30,20,45,0.55)]" aria-hidden />

      <div className="animate-slide-up pb-safe relative flex max-h-[92dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-t-[24px] bg-[var(--color-surface)] p-5 shadow-[0_-10px_40px_rgba(40,25,60,0.28)]">
        <div>
          <h2 className="text-[1.125rem] font-extrabold text-[var(--color-ink)]">{t.vendorWelcome.title}</h2>
          <p className="mt-1 text-[0.75rem] leading-[1.55] text-[var(--color-muted)]">{t.vendorWelcome.body}</p>
        </div>

        <ol className="flex flex-col gap-3">
          {[t.vendorWelcome.step1, t.vendorWelcome.step2, t.vendorWelcome.step3].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.6875rem] font-bold text-white">
                {index + 1}
              </span>
              <span className="text-[0.75rem] leading-[1.5] text-[var(--color-ink)]">{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2">
          <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">{t.vendorWelcome.installTitle}</p>
          <InstallGuide />
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="press w-full rounded-[16px] border border-[var(--color-outline)] py-3 text-[0.8125rem] font-bold text-[var(--color-brand)]"
        >
          {t.vendorWelcome.start}
        </button>
      </div>
    </div>
  );
}
