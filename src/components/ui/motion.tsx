"use client";

import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Le fournisseur d'animations, chargé après le reste.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi ce composant existe
 * ────────────────────────────────────────────────────────────────────────
 *
 * Les composants du projet utilisent `m` et non `motion` : `m` est la version
 * réduite, qui ne contient aucun moteur d'animation et attend de le recevoir
 * d'un `LazyMotion` situé au-dessus d'elle. C'est ce qui permet de ne pas
 * imposer les quelque trente kilo-octets de Framer Motion à quelqu'un qui
 * ouvre l'application pour consulter un prix.
 *
 * **Le revers est silencieux.** Un `m.div` sans fournisseur au-dessus s'affiche
 * parfaitement — au bon endroit, avec le bon style — et ne s'anime jamais.
 * Aucune erreur, aucun avertissement à l'écran, rien dans la construction. Le
 * défaut ne se voit qu'en regardant l'écran en sachant ce qu'on devrait y voir.
 *
 * C'est exactement ce qui était arrivé à l'espace chauffeur : l'interrupteur
 * à trois états, les cartes de demande de course et la liste des messages
 * étaient écrits avec des animations qui ne se sont jamais jouées, faute de
 * fournisseur sur cette page. La vue client, elle, en avait un — d'où
 * l'impression que tout fonctionnait.
 *
 * ────────────────────────────────────────────────────────────────────────
 * `strict`, et pourquoi on le garde
 * ────────────────────────────────────────────────────────────────────────
 *
 * En mode strict, utiliser `motion` au lieu de `m` lève une erreur au lieu de
 * charger silencieusement la bibliothèque entière. C'est la seule protection
 * contre l'inverse du défaut ci-dessus : un import distrait qui annulerait tout
 * le bénéfice du chargement différé, sans que personne ne s'en aperçoive.
 */

/*
  L'import se fait à l'usage, pas au chargement du module : c'est tout l'intérêt
  du procédé. Le paquet d'animations arrive après le premier rendu.
*/
const chargerAnimations = () => import("framer-motion").then((mod) => mod.domAnimation);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={chargerAnimations} strict>
      {children}
    </LazyMotion>
  );
}
