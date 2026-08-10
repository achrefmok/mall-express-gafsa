import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import { SideNav } from "./side-nav";
import type { NavVariant } from "./nav-items";
import type { UserRole } from "@/types/database";

/**
 * Coque commune aux quatre espaces — client, vendeur, admin, authentification.
 *
 * Deux mises en page, une seule structure DOM.
 *
 *   · < 1024 px — colonne unique de 520 px au maximum, barre d'onglets en bas.
 *     C'est la maquette, au pixel. Rien n'y change.
 *
 *   · ≥ 1024 px — grille à deux colonnes : navigation latérale à gauche avec
 *     de vrais libellés, contenu à droite. La barre d'onglets disparaît.
 *
 * Le passage se fait uniquement par variantes `lg:` : aucune branche
 * JavaScript, donc aucun risque de rendu différent entre serveur et client, et
 * pas de saut de mise en page à l'hydratation.
 *
 * `contentWidth` décide de la largeur utile à droite :
 *   · `wide` — catalogue, listes, tableaux de bord. Le contenu occupe l'espace.
 *   · `reading` — formulaires, caisse, fil de messages. Une colonne large ne
 *     rendrait pas ces écrans plus lisibles, au contraire.
 */
export function AppShell({
  children,
  nav,
  role,
  contentWidth = "wide",
  className,
}: {
  children: ReactNode;
  /** Jeu d'onglets latéraux. Omis sur les écrans d'authentification. */
  nav?: NavVariant;
  role?: UserRole;
  contentWidth?: "wide" | "reading";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mx-auto flex min-h-dvh max-w-[520px] flex-col bg-[var(--color-app)] shadow-[0_0_60px_rgba(60,40,90,0.06)]",
        // Grille de bureau. `minmax(0,1fr)` et non `1fr` : sans le minimum à
        // zéro, un enfant large (un rail qui déborde) élargirait la colonne
        // au lieu de défiler.
        nav
          ? "lg:grid lg:max-w-[1440px] lg:grid-cols-[252px_minmax(0,1fr)] lg:shadow-none"
          : "lg:max-w-[560px]",
        className,
      )}
    >
      {nav && <SideNav variant={nav} role={role} />}

      <div
        className={cx(
          "flex min-h-0 flex-1 flex-col",
          nav && "lg:min-h-dvh lg:px-8 lg:py-4",
          nav && contentWidth === "reading" && "lg:mx-auto lg:w-full lg:max-w-[720px]",
          nav && contentWidth === "wide" && "lg:mx-auto lg:w-full lg:max-w-[1120px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
