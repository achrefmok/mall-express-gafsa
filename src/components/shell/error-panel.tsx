"use client";

import { useEffect } from "react";
import { useI18nOptional } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/primitives";

/**
 * Une panne dans un écran, pas dans toute l'application.
 *
 * Le projet n'avait qu'une frontière d'erreur, à la racine : une requête qui
 * échouait dans un panneau du tableau de bord vendeur effaçait la coque, la
 * navigation et tout le reste. La personne perdait sa place pour un bloc.
 *
 * Rendu par un `error.tsx` d'espace, ce panneau reste *dans* la coque : les
 * onglets tiennent, on peut partir ailleurs sans recharger, et « Réessayer » ne
 * relance que le segment fautif.
 *
 * Les textes passent par la variante tolérante du contexte : un écran d'erreur
 * ne doit pas dépendre de ce qui vient peut-être de tomber.
 */
export function ErrorPanel({
  error,
  reset,
  scope,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Nommé dans le journal, pour distinguer client, vendeur et administration. */
  scope: string;
}) {
  const ctx = useI18nOptional();

  useEffect(() => {
    console.error(`Erreur ${scope}`, error.digest ?? error.message);
  }, [error, scope]);

  return (
    <div className="enter-page flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-live-tint)] text-[1.125rem] font-bold text-[var(--color-live)]">
        !
      </div>
      <p className="text-[0.875rem] font-bold text-[var(--color-ink)]">
        {ctx?.t.common.error ?? "Une erreur est survenue"}
      </p>
      <p className="max-w-[34ch] text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
        Cet écran n&apos;a pas pu se charger. Les autres onglets restent
        accessibles.
      </p>
      {error.digest && (
        <p className="font-mono text-[0.625rem] text-[var(--color-faint)]">{error.digest}</p>
      )}
      <Button size="sm" onClick={reset} className="mt-1">
        {ctx?.t.common.retry ?? "Réessayer"}
      </Button>
    </div>
  );
}
