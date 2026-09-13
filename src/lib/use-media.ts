"use client";

import { useEffect, useState } from "react";

/**
 * Une requête de média, lue depuis React.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi pas simplement `lg:` en CSS
 * ────────────────────────────────────────────────────────────────────────
 *
 * Parce que la différence n'est pas cosmétique. Sur téléphone, le panneau de
 * commande est un tiroir en `position: fixed` qu'on tire du bas ; sur grand
 * écran, c'est une colonne dans le flux. Ce ne sont pas deux styles du même
 * élément, ce sont deux structures.
 *
 * Les rendre toutes les deux et en masquer une par CSS monterait **deux
 * instances** du composant : deux états de formulaire, deux abonnements temps
 * réel sur la même course, deux sondages. Ce qu'on écrirait dans l'une ne se
 * retrouverait pas dans l'autre au redimensionnement.
 *
 * Une seule instance, donc, qui sait dans quelle forme se rendre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le premier rendu
 * ────────────────────────────────────────────────────────────────────────
 *
 * `false` au départ, y compris sur grand écran. Le serveur ne connaît pas la
 * taille de la fenêtre : rendre autre chose que ce qu'il a produit ferait
 * diverger l'hydratation. La valeur juste arrive à l'effet, une image plus
 * tard — imperceptible, et sans avertissement dans la console.
 */
export function useMedia(requete: string): boolean {
  const [correspond, setCorrespond] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia(requete);
    setCorrespond(mq.matches);

    const suivre = (e: MediaQueryListEvent) => setCorrespond(e.matches);
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, [requete]);

  return correspond;
}

/**
 * Le seuil `lg` de Tailwind, et rien d'autre.
 *
 * Écrit ici plutôt qu'à l'appel : la valeur doit rester la même que celle des
 * classes `lg:` qui l'accompagnent, et deux endroits finissent toujours par
 * diverger.
 */
export function useEstBureau(): boolean {
  return useMedia("(min-width: 1024px)");
}
