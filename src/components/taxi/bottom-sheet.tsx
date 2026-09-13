"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Un panneau qui monte du bas, et qui s'attrape.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Trois hauteurs, parce qu'une seule ne suffit jamais
 * ────────────────────────────────────────────────────────────────────────
 *
 * L'écran taxi montre deux choses à la fois : une carte, et une liste. Un
 * panneau fixe force à choisir laquelle sacrifier. Les trois positions
 * répondent aux trois moments réels :
 *
 *   · `pied`   — on regarde la carte, le panneau ne fait que dire où on en est ;
 *   · `moitie` — on compare deux ou trois chauffeurs sans perdre la carte de vue ;
 *   · `plein`  — on lit, on écrit, la carte n'a plus rien à apporter.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qui est animé, et ce qui ne l'est pas
 * ────────────────────────────────────────────────────────────────────────
 *
 * Seul `transform: translateY` bouge. Ni `height`, ni `top`, ni `bottom` :
 * ces trois-là déclenchent un recalcul de mise en page à chaque image, et sur
 * un téléphone d'entrée de gamme le panneau saute au lieu de suivre le doigt.
 * Le panneau a donc **toujours** la hauteur de sa position haute ; ce sont les
 * trois quarts du bas qui sortent de l'écran quand il est replié.
 *
 * Le geste ne passe pas par un moteur d'animation : pendant que le doigt est
 * posé, la position est écrite directement dans le style, sans re-rendu React.
 * L'animation à ressort ne reprend qu'au relâcher, pour rejoindre la position
 * la plus proche.
 */

export type HauteurSheet = "pied" | "moitie" | "plein";

/** Part de l'écran occupée par le panneau, du bas vers le haut. */
const HAUTEURS: Record<HauteurSheet, number> = {
  pied: 0.18,
  moitie: 0.52,
  plein: 0.92,
};

/** Au-delà, on considère que le doigt a lancé le panneau plutôt que posé. */
const VITESSE_LANCER = 420;

interface BottomSheetProps {
  ouvert: boolean;
  hauteur: HauteurSheet;
  onHauteur: (h: HauteurSheet) => void;
  /** Absent : le panneau ne se ferme pas au geste, il change seulement de hauteur. */
  onFermer?: () => void;
  /** Coiffe toujours visible, y compris replié. C'est elle qu'on attrape. */
  entete?: ReactNode;
  children: ReactNode;
  /** Étiquette du panneau pour les lecteurs d'écran. */
  titre?: string;
}

export function BottomSheet({
  ouvert,
  hauteur,
  onHauteur,
  onFermer,
  entete,
  children,
  titre,
}: BottomSheetProps) {
  const reduit = useReducedMotion();
  const panneau = useRef<HTMLDivElement | null>(null);
  const [vh, setVh] = useState(0);
  const [basNav, setBasNav] = useState(0);
  const [monte, setMonte] = useState(false);
  const titreId = useId();

  /*
    La hauteur de la fenêtre, relevée et tenue à jour.

    `100dvh` en CSS suffirait à dimensionner, mais le geste a besoin du nombre :
    on compare des pixels parcourus à des fractions d'écran. `visualViewport`
    plutôt que `innerHeight` parce que le clavier mobile réduit l'un et pas
    l'autre — sans quoi le panneau se cale sous le clavier dès qu'on écrit.
  */
  useEffect(() => {
    const mesurer = () => {
      setVh(window.visualViewport?.height ?? window.innerHeight);

      /*
        La barre d'onglets se mesure, elle ne se devine pas.

        Sa hauteur dépend de la zone sûre de l'appareil — une encoche, une
        barre de geste — et varie donc d'un téléphone à l'autre. Le panneau
        s'arrête juste au-dessus : on doit pouvoir quitter l'écran sans
        replier le tiroir d'abord.
      */
      const nav = document.querySelector("[data-bottom-nav]");
      setBasNav(nav instanceof HTMLElement ? nav.offsetHeight : 0);
    };
    mesurer();

    window.addEventListener("resize", mesurer);
    window.visualViewport?.addEventListener("resize", mesurer);
    return () => {
      window.removeEventListener("resize", mesurer);
      window.visualViewport?.removeEventListener("resize", mesurer);
    };
  }, []);

  /*
    La place utile, et non la fenêtre entière.

    Les fractions se comptaient sur `vh`, barre d'onglets comprise — donc le
    panneau « à mi-hauteur » en occupait davantage qu'annoncé, et le cran
    replié disparaissait presque entièrement derrière la barre.
  */
  const utile = Math.max(0, vh - basNav);
  const hauteurPx = utile * HAUTEURS.plein;

  const decalage = useCallback(
    (h: HauteurSheet) => hauteurPx - utile * HAUTEURS[h],
    [hauteurPx, utile],
  );

  /** La position la plus proche d'un décalage donné, et le sens du lancer. */
  const arrimer = useCallback(
    (y: number, vitesse: number): HauteurSheet => {
      const ordre: HauteurSheet[] = ["plein", "moitie", "pied"];

      // Un lancer franc saute d'un cran, sans chercher le plus proche : c'est
      // ce que le doigt a demandé, et le respecter donne le sentiment que le
      // panneau obéit.
      if (Math.abs(vitesse) > VITESSE_LANCER) {
        const actuel = ordre.indexOf(hauteur);
        const suivant = vitesse > 0 ? actuel + 1 : actuel - 1;
        return ordre[Math.min(ordre.length - 1, Math.max(0, suivant))];
      }

      return ordre.reduce((meilleure, candidate) =>
        Math.abs(y - decalage(candidate)) < Math.abs(y - decalage(meilleure))
          ? candidate
          : meilleure,
      );
    },
    [decalage, hauteur],
  );

  // Le portail n'existe qu'au navigateur : rien à rendre au premier passage.
  useEffect(() => setMonte(true), []);

  /*
    Rendu dans `document.body`, et c'est indispensable.

    ────────────────────────────────────────────────────────────────────────
    Ce qui cassait
    ────────────────────────────────────────────────────────────────────────

    `position: fixed` se cale sur la fenêtre — sauf si un ancêtre porte une
    transformation, auquel cas c'est cet ancêtre qui devient le bloc
    conteneur. La règle vaut pour `transform`, mais aussi pour une animation
    qui en anime un.

    C'est exactement le cas ici : `PageTransition` applique `.enter-page`,
    dont l'image-clé anime `translate3d`. Le tiroir cessait donc d'être fixé
    à la fenêtre et retombait dans le flux de la page : il poussait le
    document, la page se mettait à défiler, et la barre d'onglets — `sticky`,
    donc au-dessus du flux — passait par-dessus lui. D'où un panneau qui
    occupait tout l'écran, un bouton de recherche hors champ, et des
    conversations qui s'affichaient sous la navigation.

    Un portail vers `body` place le nœud hors de tout ancêtre transformé.
    C'est la seule correction fiable : retirer l'animation d'entrée la
    réglerait aussi, mais au prix d'une transition que toute l'application
    partage.
  */
  if (!monte) return null;

  return createPortal(
    <AnimatePresence>
      {ouvert && (
        <m.div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titre ? titreId : undefined}
          ref={panneau}
          initial={{ y: hauteurPx }}
          animate={{ y: decalage(hauteur) }}
          exit={{ y: hauteurPx }}
          transition={
            reduit
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 40, mass: 0.9 }
          }
          drag={reduit ? false : "y"}
          dragConstraints={{ top: 0, bottom: hauteurPx }}
          dragElastic={{ top: 0.02, bottom: 0.12 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const y = decalage(hauteur) + info.offset.y;
            const cible = arrimer(y, info.velocity.y);

            // Tiré franchement vers le bas depuis la position basse : on ferme,
            // quand l'appelant a prévu que cela se puisse.
            if (
              onFermer &&
              hauteur === "pied" &&
              info.offset.y > vh * 0.08 &&
              info.velocity.y > 0
            ) {
              onFermer();
              return;
            }

            if (cible !== hauteur) onHauteur(cible);
          }}
          style={{
            height: hauteurPx || undefined,
            // Au-dessus de la barre d'onglets, jamais par-dessus.
            bottom: basNav,
            // Le panneau est promu sur sa propre couche : sans cela, le flou
            // du fond est recomposé à chaque image du geste.
            willChange: "transform",
            touchAction: "none",
          }}
          className="fixed inset-x-0 bottom-0 z-[820] flex flex-col overflow-hidden rounded-t-[26px] border-t border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] shadow-[0_-10px_44px_rgba(20,14,26,0.22)]"
        >
          {/* La poignée. Une cible de 44 px, dont 4 seulement sont peints. */}
          <button
            type="button"
            aria-label={
              hauteur === "plein" ? "Réduire le panneau" : "Agrandir le panneau"
            }
            onClick={() =>
              onHauteur(hauteur === "plein" ? "moitie" : hauteur === "moitie" ? "plein" : "moitie")
            }
            className="flex h-11 w-full flex-none cursor-grab items-center justify-center active:cursor-grabbing"
          >
            <span className="h-[4px] w-10 rounded-full bg-[var(--color-hairline)]" />
          </button>

          {entete && (
            <div id={titre ? titreId : undefined} className="flex-none px-5 pb-3">
              {entete}
            </div>
          )}

          {/*
            Le défilement vit ici, pas sur le panneau.

            `overscroll-contain` empêche le geste de traverser vers la page
            derrière une fois la liste arrivée en butée — sans lui, arriver en
            bas de la liste fait défiler l'écran, ce qui est le défaut le plus
            fréquent de ce genre de panneau.
          */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            {children}
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
