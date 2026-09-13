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

  /*
    Une pilule flottante plutôt qu'un bandeau collé au bord.

    Elle occupait toute la largeur, séparée du contenu par un simple filet : la
    barre et la page se confondaient, et l'onglet actif se lisait mal. Détachée
    des bords, posée sur son ombre, elle se distingue de ce qui défile derrière
    — et le flou laisse deviner le contenu qui passe dessous, ce qui aide à
    comprendre qu'on n'a pas quitté la page.

    L'écart du bas reste en dehors de la pilule : la zone sûre des téléphones à
    encoche doit rester vide, pas colorée.
  */
  return (
    <div
      /*
        Repérable depuis un tiroir qui se pose au-dessus d elle.

        Le panneau taxi doit s arrêter juste au-dessus de cette barre plutôt
        que de la recouvrir : on doit pouvoir quitter l écran sans replier le
        tiroir d abord. Sa hauteur varie avec la zone sûre de l appareil, donc
        elle se mesure — on ne la devine pas.
      */
      data-bottom-nav
      className="sticky bottom-0 z-40 flex-none px-3 lg:hidden"
      /* L'écart voulu *plus* la zone sûre, jamais l'un à la place de l'autre :
         deux classes de rembourrage bas se seraient annulées. */
      style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
    >
      <nav
        aria-label={t.nav.home}
        className="flex justify-around rounded-[26px] border border-[var(--color-surface-edge)] bg-[var(--color-veil)] px-[6px] py-[11px] shadow-[0_12px_30px_rgba(60,40,90,0.14)] backdrop-blur-[16px]"
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
                "flex min-h-[40px] flex-1 flex-col items-center justify-center gap-[3px] text-center text-[0.5625rem] leading-[1.2]",
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
    </div>
  );
}
