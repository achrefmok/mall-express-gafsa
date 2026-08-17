"use client";

import { useEffect, useRef } from "react";

/**
 * Relire périodiquement, et seulement quand l'écran est regardé.
 *
 * Remplace un abonnement temps réel là où celui-ci coûtait plus qu'il
 * n'apportait. Sur la carte des taxis, chaque position publiée était diffusée à
 * tous les spectateurs, et chacun relisait la liste entière : le coût croissait
 * comme le produit des chauffeurs par les spectateurs, et le quota mensuel de
 * messages partait en moins d'une journée.
 *
 * Une relecture toutes les trente secondes coûte, elle, un appel par spectateur
 * et par demi-minute — indépendamment du nombre de chauffeurs en mouvement.
 *
 * Deux précautions qui font l'essentiel de l'économie :
 *
 *   · rien ne tourne quand l'onglet est masqué. Un téléphone posé dans une poche
 *     interrogeait sinon le serveur toute la journée, pour un écran que personne
 *     ne regarde ;
 *   · le retour à l'écran déclenche une relecture immédiate. Sans elle,
 *     l'utilisateur verrait jusqu'à trente secondes de données périmées à
 *     l'instant précis où il revient.
 *
 * La fonction passée est lue depuis une référence : elle peut donc changer à
 * chaque rendu — c'est le cas ordinaire d'une fonction déclarée dans un
 * composant — sans que le minuteur soit détruit et recréé à chaque fois.
 */
export function usePoll(run: () => void | Promise<void>, intervalMs: number) {
  const latest = useRef(run);
  latest.current = run;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => void latest.current();

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      // Rattraper le retard avant de reprendre la cadence.
      tick();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
