"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { MenuIcon } from "@/components/ui/icons";

/**
 * Le menu du site, derrière le bouton de la barre de recherche.
 *
 * Ce bouton existait déjà mais ne faisait rien : son gestionnaire n'était fourni
 * par aucun appelant. Un bouton inerte est pire qu'un bouton absent — on
 * l'essaie, il ne répond pas, et l'on doute du reste de l'écran.
 *
 * Ce qu'il ouvre répond à un manque distinct : les onglets du bas ne portent que
 * cinq destinations, et le taxi, le SOS ou les commandes n'y figurent pas. On les
 * trouvait en passant par Services, ou pas du tout. Le menu les réunit.
 *
 * Rendu dans le corps du document : la barre de recherche est un conteneur
 * étroit, et un panneau plein écran n'a rien à y faire.
 */

interface Entry {
  href: string;
  label: string;
  hint?: string;
}

export function SiteMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /*
    L'ordre suit l'usage, pas l'architecture.

    Acheter d'abord — c'est la raison d'être du site. Les services immédiats
    ensuite : un taxi ou un dépanneur se cherchent dans l'urgence, et fouiller
    n'est pas une option à ce moment-là. Le compte en dernier, parce qu'on y va
    en sachant déjà ce qu'on y cherche.
  */
  const groups: Array<{ title: string; entries: Entry[] }> = [
    {
      title: t.nav.marketplace,
      entries: [
        { href: "/marketplace", label: t.nav.marketplace },
        { href: "/lives", label: t.nav.lives },
        { href: "/bons-plans", label: t.nav.deals },
      ],
    },
    {
      title: t.nav.services,
      entries: [
        { href: "/taxi", label: t.taxi.title },
        { href: "/sos", label: t.sos.title },
        { href: "/services", label: t.services.title },
      ],
    },
    {
      title: t.nav.profile,
      entries: [
        { href: "/panier", label: t.cart.title },
        { href: "/commandes", label: t.nav.orders },
        { href: "/messages", label: t.account.messages },
        { href: "/profil", label: t.nav.profile },
      ],
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.a11y.openMenu}
        aria-expanded={open}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[18px] bg-[var(--color-brand)] text-white"
      >
        <MenuIcon size={14} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.a11y.openMenu}
            className="fixed inset-0 z-[85] flex flex-col justify-end"
          >
            <button
              type="button"
              aria-label={t.a11y.closeMenu}
              onClick={() => setOpen(false)}
              className="absolute inset-0 h-full w-full bg-[rgba(30,20,45,0.45)]"
            />

            <div className="animate-slide-up pb-safe relative max-h-[80%] w-full overflow-y-auto rounded-t-[24px] bg-[var(--color-surface)] p-4 shadow-[0_-10px_40px_rgba(40,25,60,0.28)] sm:mx-auto sm:max-w-[520px]">
              <div
                className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-hairline)]"
                aria-hidden
              />

              <div className="flex flex-col gap-4">
                {groups.map((group) => (
                  <section key={group.title} className="flex flex-col gap-2">
                    <h2 className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
                      {group.title}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {group.entries.map((entry) => (
                        <Link
                          key={entry.href}
                          href={entry.href}
                          onClick={() => setOpen(false)}
                          className="rounded-[14px] border border-[var(--color-surface-edge)] bg-[var(--color-app)] px-3 py-[11px] text-[12px] font-semibold text-[var(--color-ink)]"
                        >
                          {entry.label}
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full py-2 text-[11.5px] font-semibold text-[var(--color-muted)]"
              >
                {t.common.close}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
