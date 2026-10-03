"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";

interface Figure {
  value: number;
  label: string;
}

/**
 * Les chiffres comptent jusqu'à leur valeur réelle à l'entrée dans le
 * champ de vision, une seule fois — jamais une valeur inventée en cours de
 * route, seulement l'arrivée à la vraie valeur qui est animée.
 */
export function StatsCounter({ figures }: { figures: Figure[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(() => figures.map(() => 0));
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(figures.map((f) => f.value));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || played.current) return;
        played.current = true;
        observer.disconnect();

        const start = performance.now();
        const duration = 1400;
        let frame: number;

        function tick(now: number) {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(figures.map((f) => Math.round(f.value * eased)));
          if (progress < 1) frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="mx-auto grid max-w-[1140px] grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4 lg:px-8">
      {figures.map((figure, index) => (
        <Reveal key={figure.label} delay={index * 70} className="text-center">
          <p className="text-[1.875rem] leading-none font-bold text-[var(--color-brand)] tabular-nums lg:text-[2.375rem]">
            {display[index]}
          </p>
          <p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">{figure.label}</p>
        </Reveal>
      ))}
    </div>
  );
}
