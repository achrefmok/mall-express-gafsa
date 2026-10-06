"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CartIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import { format } from "@/lib/i18n/format";
import type { AppLocale } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Le panier, à portée de pouce depuis la vitrine.
 *
 * On ajoute plusieurs articles d'affilée dans une même boutique, et rien
 * ne menait ensuite à la caisse : il fallait quitter la page par la
 * flèche de retour, puis retrouver l'icône du panier ailleurs. Cette
 * page n'a pas de barre d'onglets — elle vit hors de la coque client —,
 * d'où un bouton flottant plutôt qu'un onglet.
 *
 * `count`/`total` sont scopés à CETTE boutique (une commande ne porte
 * jamais que sur une seule à la fois) — voir le calcul dans `page.tsx`,
 * pas le total global du panier qu'affiche la barre supérieure ailleurs
 * dans l'app.
 *
 * Thématisé — `--theme-accent` en fond, `--theme-accent-texte` en texte,
 * jamais l'inverse : sur Électronique ou Fête, l'accent est clair et
 * demande un texte sombre, exactement l'accord que chaque thème a déjà
 * vérifié pour ses propres boutons (`scripts/check-theme-contrast.mjs`).
 * Un repli au violet de marque pour toute page qui ne poserait pas ces
 * variables — aucune n'existe aujourd'hui, mais un composant ne doit pas
 * dépendre silencieusement d'un contexte qu'il ne vérifie pas.
 */
export function BoutiquePanierFlottant({
  count,
  total,
  freeDeliveryThreshold,
  label,
  locale,
  t,
}: {
  count: number;
  total: number;
  /** `null` = la boutique n'a pas défini de palier : pas de barre du tout. */
  freeDeliveryThreshold: number | null;
  label: string;
  locale: AppLocale;
  t: Dictionary;
}) {
  const [bump, setBump] = useState(false);
  const precedent = useRef(count);

  useEffect(() => {
    if (count > precedent.current) {
      setBump(true);
      const delai = setTimeout(() => setBump(false), 280);
      precedent.current = count;
      return () => clearTimeout(delai);
    }
    precedent.current = count;
  }, [count]);

  if (count === 0) return null;

  /*
    1 point par dinar dépensé — le vrai taux de `award_points` dans
    `place_order` (20260809000300_functions_triggers.sql), pas une valeur
    de confort inventée pour cet aperçu.
  */
  const points = Math.floor(total);

  const atteint = freeDeliveryThreshold !== null && total >= freeDeliveryThreshold;
  const pourcentage =
    freeDeliveryThreshold !== null && freeDeliveryThreshold > 0
      ? Math.min(100, (total / freeDeliveryThreshold) * 100)
      : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] px-4 pb-4">
      <Link
        href="/panier"
        aria-label={label}
        className="press pointer-events-auto flex flex-col gap-[7px] rounded-[22px] bg-[var(--color-ink)] px-3 py-[10px] text-white shadow-[0_14px_28px_rgba(0,0,0,0.28)] transition-transform duration-[280ms] ease-[cubic-bezier(0.3,1.7,0.5,1)]"
        style={{ transform: bump ? "scale(1.05)" : "scale(1)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-[10px]">
            <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--theme-accent,var(--color-brand-fill))] text-[var(--theme-accent-texte,white)]">
              <CartIcon size={17} />
              <span className="absolute -top-[4px] -end-[4px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-white px-1 text-[0.5625rem] font-extrabold text-[var(--color-ink)]">
                {count > 99 ? "99+" : count}
              </span>
            </span>
            <span className="text-[0.75rem] font-bold">{formatPrice(total, locale)}</span>
          </span>
          {points > 0 && (
            <span className="flex-none text-[0.59375rem] font-bold whitespace-nowrap text-[#d9c4ef]">
              {format(t.cart.loyaltyPoints, { points })}
            </span>
          )}
        </div>

        {pourcentage !== null && (
          <>
            <span className="h-1 overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                style={{ width: `${pourcentage}%`, background: atteint ? "#7fd1a0" : "#b99be0" }}
              />
            </span>
            <span className="text-[0.59375rem] opacity-90">
              {atteint
                ? t.cart.freeDeliveryReached
                : format(t.cart.freeDeliveryRemaining, {
                    amount: formatPrice(freeDeliveryThreshold! - total, locale),
                  })}
            </span>
          </>
        )}
      </Link>
    </div>
  );
}
