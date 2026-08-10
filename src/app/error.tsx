"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/primitives";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Le message complet reste côté serveur ; `digest` permet de retrouver
    // la trace dans les journaux sans exposer de détail au visiteur.
    console.error("Erreur de rendu", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-[var(--color-app)] px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-live-tint)] text-[20px] font-bold text-[var(--color-live)]">
        !
      </div>
      <h1 className="text-[18px] font-bold text-[var(--color-ink)]">{t.common.error}</h1>
      <p className="max-w-[34ch] text-[12px] leading-relaxed text-[var(--color-muted)]">
        Réessayez dans un instant. Si le problème persiste, revenez à l&apos;accueil.
      </p>
      {error.digest && (
        <p className="font-mono text-[10px] text-[var(--color-faint)]">{error.digest}</p>
      )}
      <Button size="sm" onClick={reset} className="mt-2">
        {t.common.retry}
      </Button>
    </div>
  );
}
