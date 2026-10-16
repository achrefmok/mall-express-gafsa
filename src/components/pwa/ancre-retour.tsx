"use client";

import { useEffect } from "react";

/**
 * « Retour » sur le téléphone ne doit pas fermer l'application installée.
 *
 * Dans l'application installée, le bouton ou le geste « retour » d'Android
 * remonte l'historique du navigateur — et ferme l'application quand il n'y a
 * plus rien derrière. Or on y entre souvent ailleurs que par l'accueil : une
 * notification (« nouvelle commande », « message »), un lien partagé ouvert
 * dans l'application, une reprise après mise en veille. La page ouverte est
 * alors la seule de l'historique, et le premier « retour » quittait tout.
 *
 * Au démarrage à froid sur une page intérieure — et seulement dans ce cas :
 * application installée, historique vide —, on glisse l'accueil de l'espace
 * *sous* la page ouverte. « Retour » y mène ; un second « retour » depuis
 * l'accueil ferme l'application, comme toute application Android.
 *
 * L'entrée glissée ne porte pas l'état du routeur Next : y revenir recharge
 * simplement l'accueil, ce qui est le comportement voulu.
 */
export function AncreRetour({ app }: { app: "gmall" | "transport" }) {
  useEffect(() => {
    const installee =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!installee || window.history.length > 1) return;

    const { pathname, search, hash } = window.location;
    const accueil = accueilDe(app, pathname);
    if (!accueil || pathname === accueil) return;

    /*
      Après les effets du routeur Next : c'est lui qui pose l'état (`__NA`) de
      l'entrée courante, et les effets d'un enfant passent avant les siens.

      Next intercepte `replaceState`/`pushState` et recopie l'état de la page
      courante dans la nouvelle entrée — l'accueil aurait alors porté l'arbre
      de la boutique, et « retour » aurait affiché la boutique sous l'adresse
      de l'accueil. `_N` lui fait laisser l'entrée telle quelle ; sans `__NA`,
      y revenir déclenche un rechargement propre de l'accueil.
    */
    const id = window.setTimeout(() => {
      const etat = window.history.state as { __NA?: boolean } | null;
      if (!etat?.__NA || window.history.length > 1) return;
      window.history.replaceState({ _N: true, ancreRetour: true }, "", accueil);
      window.history.pushState(etat, "", pathname + search + hash);
    }, 0);
    return () => window.clearTimeout(id);
  }, [app]);

  return null;
}

/** L'accueil de l'espace où l'on se trouve ; `null` : rien à glisser dessous. */
export function accueilDe(app: "gmall" | "transport", chemin: string): string | null {
  const sous = (p: string) => chemin === p || chemin.startsWith(`${p}/`);
  // Écrans d'entrée : on n'y glisse rien, ils sont eux-mêmes un point de départ.
  if (["/connexion", "/inscription", "/mot-de-passe-oublie", "/preparation", "/hors-ligne", "/auth"].some(sous)) return null;
  if (app === "transport") return "/";
  if (sous("/vendeur")) return "/vendeur";
  if (sous("/admin")) return "/admin";
  if (sous("/exposant")) return "/exposant";
  if (sous("/lelma3ardh/gestion")) return "/lelma3ardh/gestion";
  return "/accueil";
}
