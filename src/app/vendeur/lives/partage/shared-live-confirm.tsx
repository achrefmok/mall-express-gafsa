"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relayFacebookLive } from "@/app/actions/lives";
import { cx } from "@/lib/format";
import { Button, Card, fieldClass } from "@/components/ui/primitives";

/**
 * Confirmation d'un direct arrivé par partage.
 *
 * Un seul bouton, volontairement : le commerçant est déjà en train de diffuser
 * quand il arrive ici. Le titre est modifiable, mais prérempli — le produit
 * épinglé et la remise sont reportés du direct précédent, côté serveur.
 */
export function SharedLiveConfirm({
  url,
  suggestedTitle,
  shopName,
  approved,
}: {
  url: string;
  suggestedTitle: string;
  shopName: string;
  approved: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(suggestedTitle);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onRelay() {
    setError(null);

    startTransition(async () => {
      const result = await relayFacebookLive({ url, title });

      if (result.ok) {
        router.replace(`/vendeur/lives/${result.data.id}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
          Direct Facebook reconnu
        </p>

        <p className="rounded-[12px] bg-[var(--color-brand-tint)] p-2 text-[0.65625rem] break-all text-[var(--color-muted)]">
          {url}
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] text-[var(--color-muted)]">
            Titre affiché aux clients
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`Direct de ${shopName}`}
            className={fieldClass({ strong: true })}
          />
        </label>

        {approved ? (
          <Button block disabled={pending} onClick={onRelay}>
            {pending ? "Mise en ligne…" : "Passer en direct maintenant"}
          </Button>
        ) : (
          <p className="rounded-[12px] bg-[var(--color-live-tint)] p-3 text-[0.71875rem] leading-[1.55] text-[var(--color-ink)]">
            Votre boutique attend encore la validation de l&apos;administration.
            Vous pourrez diffuser dès qu&apos;elle sera approuvée.
          </p>
        )}

        {error && (
          <p role="alert" className={cx("text-[0.71875rem] font-semibold text-[var(--color-live)]")}>
            {error}
          </p>
        )}

        <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
          Le produit épinglé et la remise de votre direct précédent sont reportés.
          Vous les changerez depuis la console, en cours de diffusion.
        </p>
      </Card>

      <Link
        href="/vendeur/lives/nouveau"
        className="text-center text-[0.71875rem] font-semibold text-[var(--color-brand)]"
      >
        Régler le direct en détail plutôt
      </Link>
    </>
  );
}
