"use client";

import { usePathname } from "next/navigation";

/**
 * La transition entre écrans, et il n'y en a qu'une.
 *
 * Le contenu remonte de dix pixels en s'éclaircissant, en un quart de seconde.
 * C'est tout. Un vocabulaire restreint est ce qui sépare une interface qui
 * semble tenue d'une interface animée au hasard : quand chaque écran invente sa
 * transition, l'ensemble paraît instable même si chaque animation prise
 * isolément est réussie.
 *
 * Le `key` sur le chemin est le mécanisme entier : React remplace le nœud à
 * chaque navigation, l'animation d'entrée se rejoue, et rien n'a besoin d'être
 * orchestré. Aucun état, aucun minuteur, aucune animation de sortie —
 * l'animation de sortie obligerait à retenir l'ancien écran pendant que le
 * nouveau arrive, ce qui retarde l'affichage de ce que la personne a demandé.
 *
 * Dix pixels et non trente : à cette distance, le mouvement se ressent sans se
 * regarder. C'est la différence entre une application qui paraît fluide et une
 * application qui se fait remarquer.
 *
 * Sous `prefers-reduced-motion`, l'utilitaire dégénère en fondu instantané —
 * le contenu reste immédiatement lisible.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="enter-page flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
