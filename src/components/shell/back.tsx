"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { ArrowLeftIcon } from "@/components/ui/icons";

/*
  Combien de pas avons-nous faits *dans* l'application depuis l'ouverture ?

  Une variable de module, et non `sessionStorage` : elle repart à zéro à chaque
  chargement complet de page, ce qui est exactement la sémantique voulue. Un
  `sessionStorage` survivrait au rechargement et laisserait croire qu'un historique
  interne existe alors que le navigateur, lui, l'a oublié.
*/
let depth = 0;

/**
 * Compte les navigations internes. Monté une fois dans la coque.
 *
 * Sans ce compteur, `router.back()` est un pari : il remonte l'historique du
 * navigateur, quel qu'il soit. Un visiteur arrivé par un lien partagé, par une
 * recherche Google ou depuis la page de présentation se retrouvait éjecté du
 * site — ou renvoyé à la présentation — en touchant une flèche qui, pour lui,
 * signifiait « revenir à la liste ».
 */
export function NavDepthTracker() {
  const pathname = usePathname();

  useEffect(() => {
    depth += 1;
  }, [pathname]);

  return null;
}

/** Y a-t-il une page précédente *de ce site* vers laquelle revenir ? */
function hasInternalHistory(): boolean {
  // `depth` vaut 1 après le tout premier montage : il faut au moins un pas de
  // plus pour qu'un retour reste dans l'application.
  return depth > 1;
}

/**
 * La flèche de retour, qui ne fait jamais sortir du site.
 *
 * Deux comportements, et le second est celui qui manquait :
 *
 *   · en navigation interne, elle remonte l'historique — le geste attendu, qui
 *     préserve la position de défilement et le fil de la visite ;
 *   · à froid — première page ouverte, lien partagé, résultat de recherche —
 *     elle mène à `fallback`, une destination choisie et sensée.
 *
 * Le repli n'est pas un détail : c'est le seul cas où l'utilisateur risquait de
 * quitter l'application sans l'avoir demandé.
 */
export function BackButton({
  fallback,
  className,
}: {
  /** Où aller quand aucune page interne ne précède. */
  fallback: string;
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => (hasInternalHistory() ? router.back() : router.push(fallback))}
      aria-label={t.common.back}
      className={className ?? "-ms-1 p-1 text-[var(--color-ink)]"}
    >
      <ArrowLeftIcon size={18} />
    </button>
  );
}
