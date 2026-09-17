"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Mesurer ce que les gens vivent réellement, et non ce que mesure un banc d'essai.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi une mesure en production, alors qu'un audit local existe
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un audit lancé depuis un ordinateur de bureau relié en fibre mesure un site
 * que personne n'utilise. Le public de G-Mall ouvre l'application sur un
 * téléphone Android d'entrée de gamme, en 3G, à Gafsa. L'écart entre les deux
 * n'est pas de dix pour cent : il se compte en secondes.
 *
 * Ces relevés viennent des vrais appareils, sur les vraies pages, dans les
 * vraies conditions. C'est la seule mesure qui dise si l'application est
 * utilisable — le reste dit si elle est rapide en laboratoire.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'on garde, et ce qu'on jette
 * ────────────────────────────────────────────────────────────────────────
 *
 * Rien n'est envoyé quand la mesure est bonne. Un site qui remonte cent mille
 * relevés « tout va bien » par mois se paie un stockage pour apprendre ce
 * qu'il savait déjà, et noie le seul relevé qui comptait.
 *
 * On ne retient donc que ce qui dépasse le seuil « à améliorer » défini par
 * Google — le point où un visiteur commence à sentir que quelque chose ne va
 * pas. C'est aussi ce qui rend le dispositif gratuit : quelques relevés par
 * jour, pas cent mille.
 *
 * Aucune donnée personnelle ne circule : un nom de métrique, un nombre, un
 * chemin. Pas d'identifiant, pas de session, pas d'adresse.
 */

/*
  Les seuils de Google, en millisecondes — sauf CLS, qui est un ratio.

  Ce sont les bornes du « à améliorer », pas celles du « mauvais » : attendre
  le rouge pour s'inquiéter revient à découvrir le problème après les visiteurs.
*/
const SEUILS: Record<string, number> = {
  LCP: 2500, // Le plus gros élément affiché
  INP: 200, // Réactivité à la première interaction
  CLS: 0.1, // Décalages de mise en page
  FCP: 1800, // Premier contenu affiché
  TTFB: 800, // Premier octet
};

export function WebVitals() {
  useReportWebVitals((metrique) => {
    const seuil = SEUILS[metrique.name];
    if (seuil === undefined || metrique.value <= seuil) return;

    const corps = JSON.stringify({
      nom: metrique.name,
      valeur: Math.round(metrique.value * 1000) / 1000,
      seuil,
      note: metrique.rating,
      chemin: window.location.pathname,
    });

    /*
      `sendBeacon` plutôt que `fetch`.

      La mauvaise mesure arrive souvent au moment où l'on quitte la page — et
      c'est justement ce départ qui l'a produite. Un `fetch` est alors annulé
      par le navigateur ; `sendBeacon` est explicitement conçu pour survivre à
      la fermeture de l'onglet.

      Le repli couvre les navigateurs anciens, avec `keepalive` qui joue le
      même rôle.
    */
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/vitals", corps);
      } else {
        void fetch("/api/vitals", { method: "POST", body: corps, keepalive: true });
      }
    } catch {
      // Une mesure perdue n'est qu'une mesure perdue. Rien ne doit en dépendre.
    }
  });

  return null;
}
