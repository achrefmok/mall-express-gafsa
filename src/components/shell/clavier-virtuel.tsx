"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Le clavier du téléphone, suivi une seule fois pour toute l'application.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qui se passait
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un site ne peut ni lire ni changer la taille du clavier système ; il ne
 * voit que la place qui lui reste. Et chaque navigateur la lui montre
 * autrement :
 *
 *   · Chrome Android (avec `interactive-widget=resizes-content`, posé dans
 *     `layout.tsx`) rétrécit la fenêtre elle-même : `innerHeight` et `dvh`
 *     baissent, les éléments `fixed`/`sticky` remontent d'eux-mêmes ;
 *   · Safari iOS, et Chrome sans ce réglage, ne rétrécissent que la fenêtre
 *     *visuelle* (`visualViewport`) : la page garde sa hauteur, et tout ce qui
 *     est ancré en bas — le tiroir taxi, la zone de saisie d'un message —
 *     reste derrière le clavier.
 *
 * Le tiroir taxi se calait ainsi sur le bas de l'écran entier : clavier
 * ouvert, il n'en restait qu'une bande, et le champ « Destination » passait
 * dessous.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que ce composant publie
 * ────────────────────────────────────────────────────────────────────────
 *
 * Sur `<html>`, tenues à jour à chaque mouvement de la fenêtre visuelle :
 *
 *   --clavier           ce que le clavier recouvre de la page (0 sur Android,
 *                       qui rétrécit déjà la page) — à mettre en `bottom`
 *                       d'un élément ancré en bas ;
 *   --hauteur-visible   la hauteur réellement visible ;
 *   --nav-bas           la hauteur de la barre d'onglets (0 quand elle est
 *                       masquée) ;
 *   data-clavier="ouvert"  pendant une saisie au clavier. La barre d'onglets
 *                       se retire alors (globals.css) : elle n'a rien à faire
 *                       entre le champ et le clavier.
 *
 * Et `useClavier()` pour les composants qui ont besoin du nombre (le tiroir
 * taxi compare des pixels parcourus à des fractions d'écran).
 *
 * Enfin, le champ qui prend le focus est ramené dans la partie visible s'il
 * est caché — une fois le clavier sorti, pas avant : avant, on ne sait pas
 * encore où sera le bord.
 */

export interface EtatClavier {
  ouvert: boolean;
  /** Part de la page recouverte par le clavier, en pixels CSS. */
  recouvrement: number;
  /** Hauteur réellement visible. 0 côté serveur. */
  visible: number;
}

const FERME: EtatClavier = { ouvert: false, recouvrement: 0, visible: 0 };

let etat: EtatClavier = FERME;
const abonnes = new Set<() => void>();

function publier(suivant: EtatClavier) {
  if (
    suivant.ouvert === etat.ouvert &&
    suivant.recouvrement === etat.recouvrement &&
    suivant.visible === etat.visible
  ) {
    return;
  }
  etat = suivant;
  abonnes.forEach((f) => f());
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useClavier(): EtatClavier {
  return useSyncExternalStore(abonner, () => etat, () => FERME);
}

/** Les champs qui font sortir un clavier — pas une case à cocher, pas un bouton. */
const SAISIE =
  'textarea, [contenteditable=""], [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="hidden"])';

/** Sous ce seuil, ce n'est pas un clavier : une barre d'adresse qui se replie. */
const SEUIL = 120;

export function estSaisie(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(SAISIE) && !(el as HTMLInputElement).readOnly;
}

/**
 * Ce que le clavier recouvre de la page, d'après les deux fenêtres.
 * Exporté pour les tests : c'est le seul calcul qui ne se voit pas à l'œil.
 */
export function mesurerRecouvrement(fenetre: {
  innerHeight: number;
  vvHeight: number | null;
  vvOffsetTop: number;
  vvScale: number;
}): number {
  if (fenetre.vvHeight === null) return 0;
  // Zoom à deux doigts : la fenêtre visuelle rétrécit sans aucun clavier.
  if (fenetre.vvScale > 1.05) return 0;
  return Math.max(0, Math.round(fenetre.innerHeight - fenetre.vvHeight - fenetre.vvOffsetTop));
}

/** Remesure la barre d’onglets ; posée par l’effet principal. */
let suivreNav: () => void = () => {};

export function ClavierVirtuel() {
  const chemin = usePathname();

  // Une autre coque (client, vendeur, admin) peut porter une autre barre.
  useEffect(() => suivreNav(), [chemin]);

  useEffect(() => {
    const racine = document.documentElement;
    const vv = window.visualViewport;
    // La hauteur de la fenêtre clavier fermé, pour reconnaître le rétrécissement
    // d'Android. Relevée à nouveau à chaque changement de largeur (rotation).
    let base = window.innerHeight;
    let largeur = window.innerWidth;
    let image = 0;

    const calculer = () => {
      image = 0;
      const actif = document.activeElement;
      const saisie = estSaisie(actif);

      if (window.innerWidth !== largeur) {
        largeur = window.innerWidth;
        base = window.innerHeight;
      }
      if (!saisie) base = window.innerHeight;

      const recouvrement = mesurerRecouvrement({
        innerHeight: window.innerHeight,
        vvHeight: vv ? vv.height : null,
        vvOffsetTop: vv ? vv.offsetTop : 0,
        vvScale: vv ? vv.scale : 1,
      });
      const retrait = base - window.innerHeight;
      const ouvert = saisie && (recouvrement > SEUIL || retrait > SEUIL);
      const visible = Math.round(vv ? vv.height : window.innerHeight);

      if (ouvert) racine.dataset.clavier = "ouvert";
      else delete racine.dataset.clavier;
      racine.style.setProperty("--clavier", `${ouvert ? recouvrement : 0}px`);
      racine.style.setProperty("--hauteur-visible", `${visible}px`);

      // Après le changement d'attribut : masquée, la barre mesure 0.
      const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
      racine.style.setProperty("--nav-bas", `${nav?.offsetHeight ?? 0}px`);

      publier({ ouvert, recouvrement: ouvert ? recouvrement : 0, visible });
    };

    const planifier = () => {
      if (!image) image = requestAnimationFrame(calculer);
    };

    /** Ramène le champ actif dans la partie visible, s'il en est sorti. */
    const garderVisible = () => {
      const actif = document.activeElement;
      if (!estSaisie(actif)) return;
      const r = actif.getBoundingClientRect();
      const haut = vv ? vv.offsetTop : 0;
      const bas = haut + (vv ? vv.height : window.innerHeight);
      if (r.top < haut + 8 || r.bottom > bas - 8) {
        actif.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };

    const minuteurs: number[] = [];
    const surFocus = (e: FocusEvent) => {
      if (!estSaisie(e.target as Element)) return;
      planifier();
      // Le clavier met 250 à 400 ms à sortir, et un tiroir peut s'agrandir
      // juste après : on vérifie une fois sorti, puis une fois tout posé.
      minuteurs.forEach(clearTimeout);
      minuteurs.length = 0;
      minuteurs.push(window.setTimeout(garderVisible, 350), window.setTimeout(garderVisible, 750));
    };
    // Le focus part avant que le clavier ne rentre : on attend la fenêtre suivante.
    const surSortie = () => window.setTimeout(planifier, 60);

    calculer();
    vv?.addEventListener("resize", planifier);
    vv?.addEventListener("scroll", planifier);
    window.addEventListener("resize", planifier);
    document.addEventListener("focusin", surFocus);
    document.addEventListener("focusout", surSortie);

    // La barre d'onglets change d'une coque à l'autre : on la remesure quand
    // elle change de taille, et à chaque navigation (effet ci-dessus).
    const obs = new ResizeObserver(planifier);
    suivreNav = () => {
      obs.disconnect();
      const nav = document.querySelector("[data-bottom-nav]");
      if (nav) obs.observe(nav);
      planifier();
    };
    suivreNav();

    return () => {
      cancelAnimationFrame(image);
      minuteurs.forEach(clearTimeout);
      vv?.removeEventListener("resize", planifier);
      vv?.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
      document.removeEventListener("focusin", surFocus);
      document.removeEventListener("focusout", surSortie);
      obs.disconnect();
      suivreNav = () => {};
    };
  }, []);

  return null;
}
