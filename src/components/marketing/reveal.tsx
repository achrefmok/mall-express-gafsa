"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/format";

/**
 * Révèle son contenu quand il entre dans le champ de vision.
 *
 * L'état de départ (opacité 0, léger décalage) est posé par la classe
 * `reveal` dans globals.css, pas ici : si ce script ne charge pas, la
 * feuille de style le sait et laisse le contenu visible. Une page de
 * présentation ne doit jamais dépendre de JavaScript pour être lisible.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  as?: ElementType;
  /** Décalage en millisecondes, pour faire apparaître une grille en cascade. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Pas d'observateur : on montre tout de suite plutôt que de cacher.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect(); // une seule fois : pas de clignotement au retour
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-shown={shown ? "true" : undefined}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={cx("reveal", className)}
    >
      {children}
    </Tag>
  );
}
