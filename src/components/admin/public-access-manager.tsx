"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { definirAccesPublic } from "@/app/actions/admin";
import { Button, Card } from "@/components/ui/primitives";

/**
 * L'interrupteur d'accès public — voir la garde dans
 * `src/lib/supabase/middleware.ts` pour ce que chaque état autorise.
 *
 * Une confirmation avant chaque bascule : fermer l'accès renvoie
 * immédiatement tout visiteur en cours de navigation vers la page de
 * préparation, et l'ouvrir rend l'application visible à tout le monde. Ni
 * l'un ni l'autre ne se rattrape en rechargeant la page.
 */
export function PublicAccessManager({ current }: { current: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function basculer() {
    setError(null);
    const cible = !current;
    const confirmation = cible ? t.preparation.confirmOpen : t.preparation.confirmClose;
    if (!window.confirm(confirmation)) return;

    startTransition(async () => {
      const r = await definirAccesPublic(cible);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">
        {current ? t.preparation.statusOpen : t.preparation.statusClosed}
      </p>
      <p className="text-[0.625rem] leading-[1.5] text-[var(--color-muted)]">
        {t.preparation.settingsBody}
      </p>

      {error && (
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <Button tone={current ? "ghost" : undefined} onClick={basculer} disabled={pending}>
        {pending ? t.common.loading : current ? t.preparation.closeAction : t.preparation.openAction}
      </Button>
    </Card>
  );
}
