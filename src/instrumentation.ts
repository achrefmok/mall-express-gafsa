/**
 * Le filet qui attrape ce que personne n'a attrapé.
 *
 * L'audit du 26 août 2026 relevait qu'aucune erreur serveur ne remontait nulle
 * part : ni outil de suivi, ni fichier d'instrumentation. Une action serveur
 * qui levait, un rendu de page qui échouait, une route d'API qui plantait
 * laissaient une trace dans les journaux de l'hébergeur — sans forme, sans
 * contexte, et surtout sans que personne n'ait de raison d'aller les ouvrir.
 *
 * `onRequestError` est le crochet de Next pour cela : il reçoit **toute**
 * exception non rattrapée côté serveur, quel que soit l'endroit — rendu,
 * action, route, intergiciel. Là où `signaler` couvre les erreurs qu'on a
 * choisi d'absorber, celui-ci couvre celles qu'on n'avait pas vues venir.
 *
 * Aucun service tiers n'est requis. La sortie est structurée et porte le même
 * marqueur que le reste, ce qui suffit à chercher — et, plus tard, à alerter.
 */

import type { Instrumentation } from "next";
import { signaler } from "@/lib/signal";

export function register() {
  /*
    Rien à préparer aujourd'hui.

    Cette fonction est le point d'entrée conventionnel du fichier ; Next exige
    sa présence pour prendre `onRequestError` en compte. C'est aussi ici que
    l'initialisation d'un service de suivi viendrait se placer, le jour venu,
    sans rien changer ailleurs.
  */
}

export const onRequestError: Instrumentation.onRequestError = (
  erreur,
  requete,
  contexte,
) => {
  try {
    const e = erreur as { message?: string; digest?: string; stack?: string };

    /*
      Sentry reçoit l'erreur avec son contexte de requête.

      `signaler` s'occupe de l'envoi et de sa propre absence de DSN ; on lui
      donne ici ce que seul ce crochet connaît — le chemin, la méthode, le
      condensé que l'utilisateur voit sur sa page d'erreur.
    */
    signaler(erreur, {
      ou: "requête serveur",
      quoi: {
        chemin: requete.path,
        methode: requete.method,
        digest: e?.digest,
        routeur: contexte.routerKind,
        type: contexte.routeType,
      },
    });

    console.error(
      "[mall-express:erreur]",
      JSON.stringify({
        ou: "requête serveur",
        message: e?.message ?? String(erreur),
        // Le condensé est ce que Next affiche à l'utilisateur sur une page
        // d'erreur. C'est le seul lien entre sa capture d'écran et ce journal.
        digest: e?.digest,
        chemin: requete.path,
        methode: requete.method,
        routeur: contexte.routerKind,
        type: contexte.routeType,
        rendu: contexte.renderSource,
        at: new Date().toISOString(),
      }),
      e?.stack ?? "",
    );
  } catch {
    // Un crochet d'erreur qui lève à son tour masquerait l'erreur d'origine.
  }
};
