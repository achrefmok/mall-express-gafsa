"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { upsertZoneLivraison, deleteZoneLivraison } from "@/app/actions/vendor";
import { formatPrice } from "@/lib/format";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { TopBar } from "@/components/shell/top-bar";
import type { ZoneLivraison } from "@/lib/boutique-themes/attributs-server";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";
const FIELD =
  "rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-2 text-[0.75rem] outline-none";

/** Liste des zones existantes, puis un formulaire pour en ajouter une. */
export function LivraisonClient({ zones }: { zones: ZoneLivraison[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [delay, setDelay] = useState("");

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const result = await upsertZoneLivraison({
        name,
        price: Number.parseFloat(price.replace(",", ".")) || 0,
        delayMinutes: Number.parseInt(delay, 10) || 0,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setPrice("");
      setDelay("");
      router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteZoneLivraison(id);
      router.refresh();
    });
  }

  return (
    <>
      <TopBar title="Tarifs de livraison" back="/vendeur" />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        {zones.length === 0 ? (
          <EmptyState title="Aucune zone pour l'instant" />
        ) : (
          <div className="flex flex-col gap-2">
            {zones.map((zone) => (
              <Card key={zone.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-bold">{zone.name}</p>
                  <p className="truncate text-[0.6875rem] text-[var(--color-muted)]">
                    {formatPrice(zone.price, "fr")} · {zone.delay_minutes} min
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(zone.id)}
                  disabled={pending}
                  className="flex-none text-[0.6875rem] font-bold text-[var(--color-live)] disabled:opacity-40"
                >
                  Supprimer
                </button>
              </Card>
            ))}
          </div>
        )}

        <Card className="flex flex-col gap-[10px] p-3">
          <span className={LABEL}>Nouvelle zone</span>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>Nom de la zone</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gafsa centre" className={FIELD} />
          </label>

          <div className="flex gap-[10px]">
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Prix (DT)</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="5" className={FIELD} />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Délai (min)</span>
              <input value={delay} onChange={(e) => setDelay(e.target.value)} inputMode="numeric" placeholder="25" className={FIELD} />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
              {error}
            </p>
          )}

          <Button block onClick={onCreate} disabled={pending || !name.trim() || !price.trim() || !delay.trim()}>
            {pending ? "Enregistrement…" : "Ajouter la zone"}
          </Button>
        </Card>
      </div>
    </>
  );
}
