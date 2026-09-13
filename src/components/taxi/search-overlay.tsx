"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Overlay de recherche premium.
 *
 * Quand le client lance une recherche, l'écran actuel se floute légèrement,
 * un panneau central apparaît avec une animation de scale+opacity, l'icône
 * taxi effectue un mouvement orbital, et le texte se révèle progressivement.
 *
 * Quand les résultats arrivent, le blur diminue et les cartes chauffeur
 * apparaissent une par une avec un stagger subtil.
 */

type EtatRecherche = "idle" | "searching" | "results";

interface SearchOverlayProps {
  etat: EtatRecherche;
  nbChauffeurs?: number;
}

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

export function SearchOverlay({ etat, nbChauffeurs = 0 }: SearchOverlayProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (etat !== "searching") {
      setPhase(0);
      return;
    }

    // Progression des messages pendant la recherche
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [etat]);

  return (
    <AnimatePresence mode="wait">
      {etat === "searching" && (
        <m.div
          key="search-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[800] flex items-center justify-center"
        >
          {/* Blur backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[rgba(20,14,26,0.45)] backdrop-blur-[8px]"
          />

          {/* Panneau central */}
          <m.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={SPRING}
            className="relative mx-4 flex max-w-[340px] flex-col items-center gap-5 rounded-[24px] bg-[rgba(255,255,255,0.92)] p-8 shadow-[0_20px_60px_rgba(20,14,26,0.18)] backdrop-blur-[12px] dark:bg-[rgba(30,24,40,0.92)]"
          >
            {/* Icône taxi animée */}
            <m.div
              animate={{
                x: [0, -6, 6, -3, 3, 0],
                rotate: [0, -2, 2, -1, 1, 0],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--color-brand-tint,rgba(131,56,228,0.1))]"
            >
              <span className="text-[2rem]">🚕</span>
            </m.div>

            {/* Texte progressif */}
            <div className="flex flex-col items-center gap-2 text-center">
              <AnimatePresence mode="wait">
                {phase === 0 && (
                  <m.p
                    key="p0"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="text-[0.9375rem] font-bold text-[var(--color-ink)]"
                  >
                    Recherche de taxis…
                  </m.p>
                )}
                {phase === 1 && (
                  <m.p
                    key="p1"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="text-[0.9375rem] font-bold text-[var(--color-ink)]"
                  >
                    Recherche des chauffeurs disponibles…
                  </m.p>
                )}
                {phase === 2 && (
                  <m.p
                    key="p2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="text-[0.9375rem] font-bold text-[var(--color-ink)]"
                  >
                    {nbChauffeurs > 0
                      ? `${nbChauffeurs} chauffeur${nbChauffeurs > 1 ? "s" : ""} trouvé${nbChauffeurs > 1 ? "s" : ""}`
                      : "Recherche en cours…"}
                  </m.p>
                )}
              </AnimatePresence>
            </div>

            {/* Barre de progression animée */}
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-field)]">
              <m.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="h-full w-1/2 rounded-full bg-[var(--color-brand-fill)]"
              />
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Carte chauffeur avec animation stagger.
 *
 * Chaque carte apparaît avec un délai progressif quand les résultats arrivent.
 */
export function StaggeredCard({
  index,
  visible,
  children,
  className,
}: {
  index: number;
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{
            delay: index * 0.06,
            duration: 0.35,
            ease: [0.32, 0.72, 0, 1],
          }}
          className={className}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Overlay glassmorphism pour les états de course.
 *
 * Affiche par-dessus la carte avec un flou léger et un fond semi-transparent.
 */
export function GlassOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[750] flex items-end justify-center sm:items-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-[rgba(20,14,26,0.35)] backdrop-blur-[6px]" />
          <m.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={SPRING}
            className="relative w-full max-w-[560px] rounded-t-[22px] bg-[rgba(255,255,255,0.88)] p-5 shadow-[0_-8px_32px_rgba(20,14,26,0.12)] backdrop-blur-[16px] sm:rounded-[22px] dark:bg-[rgba(30,24,40,0.88)]"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
