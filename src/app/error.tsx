"use client";

import { useEffect } from "react";
import { useI18nOptional } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/primitives";

/*
  Écran d'erreur d'un segment.

  Il appelait `useI18n()`, qui *lève une exception* quand son fournisseur est
  absent. Or ce fournisseur vit dans la coque racine — précisément ce qui peut
  être en train d'échouer. La page d'erreur plantait alors à son tour, et le
  visiteur recevait l'écran brut de Next : sans marque, sans explication, sans
  issue.

  Elle lit désormais ses textes par la variante tolérante, et retombe sur le
  français quand le contexte manque. Une page d'erreur ne doit dépendre de rien.
*/

const REPLI = {
  title: "Une erreur est survenue",
  retry: "Réessayer",
  home: "Accueil",
};

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ctx = useI18nOptional();
  const textes = ctx
    ? { title: ctx.t.common.error, retry: ctx.t.common.retry, home: ctx.t.nav.home }
    : REPLI;

  useEffect(() => {
    // Le message complet reste côté serveur ; `digest` permet de retrouver
    // la trace dans les journaux sans exposer de détail au visiteur.
    console.error("Erreur de rendu", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-[var(--color-app)] px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-live-tint)] text-[1.25rem] font-bold text-[var(--color-live)]">
        !
      </div>
      <h1 className="text-[1.125rem] font-bold text-[var(--color-ink)]">{textes.title}</h1>
      <p className="max-w-[34ch] text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
        Réessayez dans un instant. Si le problème persiste, revenez à l&apos;accueil.
      </p>
      {error.digest && (
        <p className="font-mono text-[0.625rem] text-[var(--color-faint)]">{error.digest}</p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={reset}>
          {textes.retry}
        </Button>
        {/*
          Une seconde issue, en dur.

          « Réessayer » relance le rendu qui vient d'échouer : si la cause est
          durable, il échoue encore, et l'écran devient un cul-de-sac. Un lien
          natif — jamais le routeur, qui peut faire partie du problème — ramène
          toujours quelque part.
        */}
        <a
          href="/accueil"
          className="inline-flex items-center justify-center rounded-[16px] px-3 py-[7px] text-[0.65625rem] font-semibold text-[var(--color-brand)]"
        >
          {textes.home}
        </a>
      </div>
    </div>
  );
}
