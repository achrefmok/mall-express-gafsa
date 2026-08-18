"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";
import { isActive, useNavItems, type NavVariant } from "./nav-items";

/**
 * Barre d'onglets. Trois jeux — client (6), vendeur (5), admin (5) —
 * conformes au handoff. Hauteur ~44 px hors zone sûre, libellés 9 px.
 *
 * Masquée à partir de `lg` : la navigation passe alors dans la colonne
 * latérale (`SideNav`), qui a la place d'afficher de vrais libellés.
 */
export function BottomNav({ variant }: { variant: NavVariant }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = useNavItems(variant);

  return (
    <nav
      aria-label={t.nav.home}
      className="pb-safe sticky bottom-0 z-40 flex flex-none justify-around border-t border-white/90 bg-white/72 px-1 pt-3 pb-3 backdrop-blur-[12px] lg:hidden"
    >
      {items.map((item) => {
        const active = isActive(pathname, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            /* Repère du guide d'utilisation. La colonne latérale porte le même :
               l'un des deux est masqué selon la largeur, et le guide garde
               celui qui est visible. */
            data-tour={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-[44px] flex-1 flex-col items-center justify-start gap-[3px] text-center text-[9px] leading-[1.2]",
              active ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]",
            )}
          >
            <span aria-hidden className="flex h-[17px] items-center">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
