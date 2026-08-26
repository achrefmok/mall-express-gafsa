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
/**
 * Combien de temps attendre après un échec.
 *
 * Le sondage tournait à cadence fixe quoi qu'il arrive : si la base répondait
 * en erreur, la panne était interrogée exactement aussi vite que le service en
 * état de marche — sept sondages simultanés sur l'écran d'un chauffeur, toutes
 * les quatre à trente secondes, sans relâche.
 *
 * On double donc l'attente à chaque échec consécutif, à partir du deuxième :
 * le premier peut n'être qu'un tunnel. Le plafond d'une minute garde l'écran
 * réactif au retour du réseau, tout en divisant la charge par quinze sur le
 * sondage le plus serré.
 */
const ECHECS_AVANT_REPLI = 2;
const REPLI_MAX_MS = 60_000;

/**
 * `false` dit « cela n'a pas marché ».
 *
 * Les appelants ne lèvent pas d'exception — le client Supabase renvoie une
 * erreur dans son résultat plutôt que de la jeter — donc le crochet ne pouvait
 * pas deviner qu'une relecture avait échoué. Retourner `false` est la façon la
 * plus légère de le lui dire, et ne rien retourner reste parfaitement valable
 * pour un appelant qui ne sait pas distinguer les deux cas.
 */
export type Resultat = void | boolean;

export function usePoll(run: () => Resultat | Promise<Resultat>, intervalMs: number) {
  const latest = useRef(run);
  latest.current = run;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let echecs = 0;
    let arrete = false;

    /* Un minuteur qui se replante lui-même, et non un intervalle fixe : c'est
       ce qui permet à l'attente de varier d'un tour à l'autre. */
    const attente = () => {
      if (echecs < ECHECS_AVANT_REPLI) return intervalMs;
      const facteur = 2 ** (echecs - ECHECS_AVANT_REPLI + 1);
      return Math.min(REPLI_MAX_MS, intervalMs * facteur);
    };

    const planifier = () => {
      if (arrete || timer !== null) return;
      timer = setTimeout(tick, attente());
    };

    const stop = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    };

    const tick = async () => {
      timer = null;

      try {
        const resultat = await latest.current();
        // Seul un `false` explicite compte comme un échec : `undefined` est le
        // retour normal d'un appelant qui ne se prononce pas.
        echecs = resultat === false ? echecs + 1 : 0;
      } catch {
        echecs += 1;
      }

      planifier();
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }

      /*
        Le retour à l'écran remet le compteur à zéro.

        Quelqu'un qui revient sur l'application veut des données fraîches tout
        de suite, et l'échec d'il y a dix minutes ne dit rien de l'état du
        réseau maintenant. Rattraper le retard, puis reprendre la cadence
        nominale.
      */
      echecs = 0;
      stop();
      void tick();
    };

    if (!document.hidden) planifier();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      arrete = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
