"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useInstallPrompt } from "./use-install-prompt";

const SEEN_KEY = "meg-install-sheet-seen";

/**
 * Le panneau d'installation, ouvert depuis le profil.
 *
 * Il s'affiche de lui-même la première fois qu'on ouvre le profil, puis plus
 * jamais sans qu'on le demande. Le profil est le bon endroit : c'est l'écran
 * qu'on visite en s'installant dans l'application, pas en cherchant un produit.
 *
 * Là où le navigateur le permet — Android, Chrome, Edge — un seul appui suffit,
 * et le système prend la suite. Sur iPhone, Safari n'expose aucune API : Apple
 * réserve l'installation à son menu de partage. Aucune bibliothèque ne contourne
 * cela. On montre donc le geste, illustré et en trois mots, plutôt que de
 * laisser le visiteur chercher — c'est le mieux qu'un site puisse faire là, et il
 * faut le dire franchement.
 *
 * L'invitation à ouvrir une boutique voyage avec ce panneau : elle a quitté
 * l'écran d'inscription, où elle imposait à chaque acheteur de lire un texte qui
 * ne le concernait pas.
 */
export function InstallSheet({ vendorSignUpUrl }: { vendorSignUpUrl?: string | null }) {
  const { t } = useI18n();
  const { state, isIOS, canInstallInOneTap, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);

  /*
    Ouverture automatique, une seule fois.

    Le drapeau est posé à l'ouverture et non à la fermeture : un visiteur qui
    quitte l'écran sans rien toucher a quand même vu le panneau, et le lui
    remontrer à chaque passage le rendrait pénible.
  */
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(true);
  }, []);

  // Rien à proposer : déjà installée, et aucune boutique à annoncer.
  if (state.kind === "installed" && !vendorSignUpUrl) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[18px] border border-[var(--color-outline)] py-3 text-[0.75rem] font-semibold text-[var(--color-brand)]"
      >
        {state.kind === "installed" ? t.install.openSheet : t.install.action}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.install.title}
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      {/* Le voile ferme au toucher : c'est le geste attendu d'une feuille. */}
      <button
        type="button"
        aria-label={t.common.close}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-[rgba(30,20,45,0.45)]"
      />

      <div className="animate-slide-up pb-safe relative w-full max-w-[520px] rounded-t-[24px] bg-[var(--color-surface)] p-4 shadow-[0_-10px_40px_rgba(40,25,60,0.28)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-hairline)]" aria-hidden />

        <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{t.install.title}</h2>
        <p className="mt-1 text-[0.71875rem] leading-[1.5] text-[var(--color-muted)]">
          {t.install.body}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {state.kind === "installed" && (
            <p className="rounded-[14px] bg-[var(--color-brand-tint)] p-3 text-[0.71875rem] font-semibold text-[var(--color-ink)]">
              {t.install.already}
            </p>
          )}

          {/* ── Un seul appui, là où le navigateur le permet ─────────── */}
          {canInstallInOneTap && (
            <button
              type="button"
              onClick={() => void install().then(() => setOpen(false))}
              className="w-full rounded-[16px] bg-[var(--color-brand-fill)] py-3 text-[0.78125rem] font-bold text-white"
            >
              {t.install.oneTap}
            </button>
          )}

          {/* ── iPhone : le geste, décrit ────────────────────────────── */}
          {state.kind === "manual" && isIOS && (
            <ol className="flex flex-col gap-2 rounded-[16px] bg-[var(--color-app)] p-3">
              {[t.install.iosStep1, t.install.iosStep2, t.install.iosStep3].map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.625rem] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-[0.71875rem] leading-[1.45] text-[var(--color-ink)]">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {/* ── Autres navigateurs sans invite disponible ────────────── */}
          {state.kind === "manual" && !isIOS && (
            <p className="rounded-[16px] bg-[var(--color-app)] p-3 text-[0.71875rem] leading-[1.5] text-[var(--color-ink)]">
              {t.install.otherHint}
            </p>
          )}

          {/*
            L'invitation aux commerçants, à sa place enfin.

            Absente quand rien n'est découpé : le lien mènerait alors à
            l'inscription qu'on vient de quitter.
          */}
          {vendorSignUpUrl && (
            <a
              href={vendorSignUpUrl}
              className="mt-1 w-full rounded-[16px] border border-[var(--color-outline)] py-3 text-center text-[0.75rem] font-semibold text-[var(--color-brand)]"
            >
              {t.auth.switchToVendorSignUp}
            </a>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="py-2 text-[0.71875rem] font-semibold text-[var(--color-muted)]"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
