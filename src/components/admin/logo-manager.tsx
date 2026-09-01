"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAppLogo } from "@/app/actions/admin";
import { deleteImage, uploadImage } from "@/lib/upload";
import { Button, Card } from "@/components/ui/primitives";

/**
 * Le logo de l'application, changé depuis l'administration.
 *
 * Une photo est envoyée dans le stockage, son URL est mémorisée dans
 * `app_brand`, et l'écran de bienvenue la montre à la place du monogramme
 * « M ». Sans redéploiement : la valeur vit en base.
 */
export function LogoManager({ current }: { current: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);

    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      startTransition(async () => {
        const result = await setAppLogo(publicUrl);
        if (result.ok) router.refresh();
        else setError(result.error);
      });
    } catch {
      setError("Envoi impossible");
    }
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const was = current;
      const result = await setAppLogo(null);
      if (result.ok) {
        // L'ancien fichier n'a plus de référence en base : on le retire.
        if (was) void deleteImage("shop-assets", was).catch(() => {});
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-[18px] bg-[var(--color-brand-tint)] text-[1.125rem] font-bold text-[var(--color-brand)]">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element -- vignette d'administration
            <img src={current} alt="" className="h-full w-full object-cover" />
          ) : (
            "M"
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">Logo de l&apos;application</p>
          <p className="text-[0.625rem] leading-[1.4] text-[var(--color-muted)]">
            Affiché sur l&apos;écran de bienvenue. Présent sans redéploiement.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <label className="press inline-flex flex-none items-center justify-center rounded-[16px] bg-[var(--color-brand-fill)] px-4 py-3 text-[0.75rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={pending}
            onChange={(event) => void onPick(event.target.files?.[0])}
          />
          {current ? "Remplacer" : "Choisir un logo"}
        </label>

        {current && (
          <Button tone="ghost" size="md" disabled={pending} onClick={remove}>
            Retirer
          </Button>
        )}
      </div>
    </Card>
  );
}
