"use client";

import { useEffect, useState } from "react";
import { decompte } from "@/lib/black-friday";
import { cx } from "@/lib/format";

/**
 * « 02 h 11 min 07 s », trois cases chiffrées — l'« offre du jour » de la
 * boutique. Même mécanique que `AvantDebut` (rendu différé au montage,
 * recalculé chaque seconde), mais en cases plutôt qu'en phrase : c'est ce
 * format qui dit « ça presse » sur une promotion déjà commencée.
 */
export function CompteARebours({ jusqua, className }: { jusqua: string; className?: string }) {
  const [reste, setReste] = useState<number | null>(null);

  useEffect(() => {
    const echeance = new Date(jusqua).getTime();
    if (Number.isNaN(echeance)) return;

    const majour = () => setReste(Math.max(0, echeance - Date.now()));
    majour();
    const minuterie = setInterval(majour, 1000);
    return () => clearInterval(minuterie);
  }, [jusqua]);

  if (reste === null) return null;
  const d = decompte(reste);
  if (d.ecoule) return null;

  const heures = d.jours * 24 + d.heures;
  const deux = (n: number) => String(n).padStart(2, "0");
  const cases = [
    [deux(heures), "h"],
    [deux(d.minutes), "min"],
    [deux(d.secondes), "s"],
  ] as const;

  return (
    <span className={cx("flex flex-none gap-[3px]", className)} dir="ltr">
      {cases.map(([valeur, unite]) => (
        <span
          key={unite}
          className="flex min-w-[28px] flex-col items-center rounded-[9px] bg-[var(--color-ink)] px-1 py-[4px] text-white"
        >
          <b className="text-[0.75rem] leading-[1.1] font-bold tabular-nums">{valeur}</b>
          <span className="text-[0.46875rem] opacity-70">{unite}</span>
        </span>
      ))}
    </span>
  );
}
