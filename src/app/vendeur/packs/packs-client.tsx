"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { upsertPack, deletePack } from "@/app/actions/vendor";
import { formatPrice } from "@/lib/format";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { TopBar } from "@/components/shell/top-bar";
import type { PackBoutique } from "@/components/boutique/layouts/types";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";
const FIELD =
  "rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-2 text-[0.75rem] outline-none";

interface Produit {
  id: string;
  name: string;
  price: number;
  images: string[];
}

/** Liste des packs existants, puis un formulaire pour en créer un nouveau. */
export function PacksClient({ packs, produits }: { packs: PackBoutique[]; produits: Produit[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("15");
  const [selection, setSelection] = useState<string[]>([]);

  function toggle(id: string) {
    setSelection((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const result = await upsertPack({
        name,
        discountPercent: Number.parseInt(discount, 10) || 0,
        productIds: selection,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setDiscount("15");
      setSelection([]);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deletePack(id);
      router.refresh();
    });
  }

  return (
    <>
      <TopBar title="Packs" back="/vendeur" />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        {packs.length === 0 ? (
          <EmptyState title="Aucun pack pour l'instant" />
        ) : (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => (
              <Card key={pack.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-bold">{pack.name}</p>
                  <p className="truncate text-[0.6875rem] text-[var(--color-muted)]">
                    −{pack.discount_percent}% · {pack.items.map((i) => i.name).join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(pack.id)}
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
          <span className={LABEL}>Nouveau pack</span>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>Nom du pack</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>Remise (%)</span>
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="numeric" className={FIELD} />
          </label>

          <span className={LABEL}>Produits du pack ({selection.length} sélectionné(s))</span>
          {produits.length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">
              Ajoutez d&apos;abord des produits en ligne — un pack en regroupe au moins deux.
            </p>
          ) : (
            <div className="flex flex-col gap-[6px]">
              {produits.map((p) => {
                const coche = selection.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="flex items-center gap-[10px] rounded-[12px] border p-[8px] text-start"
                    style={{
                      borderColor: coche ? "var(--color-brand)" : "var(--color-outline)",
                      background: coche ? "var(--color-brand-tint)" : "transparent",
                    }}
                  >
                    <span
                      className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border-2 text-[0.625rem] text-white"
                      style={{
                        borderColor: "var(--color-brand)",
                        background: coche ? "var(--color-brand-fill)" : "transparent",
                      }}
                    >
                      {coche ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.75rem] font-semibold">{p.name}</span>
                    <span className="flex-none text-[0.6875rem] text-[var(--color-muted)]">{formatPrice(p.price, "fr")}</span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
              {error}
            </p>
          )}

          <Button block onClick={onCreate} disabled={pending || !name.trim() || selection.length < 2}>
            {pending ? "Enregistrement…" : "Créer le pack"}
          </Button>
        </Card>
      </div>
    </>
  );
}
