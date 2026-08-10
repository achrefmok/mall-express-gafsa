"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { addToCart, toggleFavorite } from "@/app/actions/cart";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { ArrowLeftIcon, HeartIcon, ShareIcon } from "@/components/ui/icons";

/** Barre supérieure de la fiche : retour, favori, partage. */
export function ProductTopBar({
  productId,
  productName,
  isFavorite: initial,
}: {
  productId: string;
  productName: string;
  isFavorite: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [favorite, setFavorite] = useState(initial);
  const [, startTransition] = useTransition();

  function onFavorite() {
    // Bascule optimiste : le cœur doit répondre au doigt sans attendre le
    // serveur ; on revient en arrière si l'écriture échoue.
    const previous = favorite;
    setFavorite(!previous);

    startTransition(async () => {
      const result = await toggleFavorite(productId, previous);
      if (!result.ok) setFavorite(previous);
    });
  }

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: productName, url });
        return;
      } catch {
        // Partage annulé par l'utilisateur : on ne fait rien.
        return;
      }
    }
    await navigator.clipboard?.writeText(url);
  }

  return (
    <header className="flex flex-none items-center justify-between px-[18px] pt-4 pb-3">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t.common.back}
        className="-ms-1 p-1 text-[var(--color-ink)]"
      >
        <ArrowLeftIcon size={18} />
      </button>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? t.product.unfavorite : t.product.favorite}
          className={cx("p-1", favorite ? "text-[var(--color-live)]" : "text-[var(--color-ink)]")}
        >
          <HeartIcon filled={favorite} size={18} />
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label={t.common.share}
          className="p-1 text-[var(--color-ink)]"
        >
          <ShareIcon size={18} />
        </button>
      </div>
    </header>
  );
}

/** Sélection couleur/taille + barre d'action fixe. */
export function ProductActions({
  product,
}: {
  product: {
    id: string;
    name: string;
    stock: number;
    colors: string[];
    sizes: string[];
    shopSlug: string;
  };
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);
  const [size, setSize] = useState<string | null>(product.sizes[0] ?? null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const soldOut = product.stock <= 0;

  function onAdd() {
    setFeedback(null);

    startTransition(async () => {
      const result = await addToCart({ productId: product.id, color, size });

      if (result.ok) {
        setFeedback({ kind: "ok", message: t.product.added });
        router.refresh();
      } else {
        setFeedback({
          kind: "error",
          message:
            result.error === "Authentification requise" ? t.common.signInRequired : result.error,
        });
        if (result.error === "Authentification requise") {
          router.push(`/connexion?suite=/produit/${product.id}`);
        }
      }
    });
  }

  return (
    <>
      {product.colors.length > 0 && (
        <fieldset className="mt-1 flex flex-col gap-2">
          <legend className="sr-only">{t.product.colors}</legend>
          <div className="flex gap-2">
            {product.colors.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={value}
                aria-pressed={color === value}
                className={cx(
                  "h-[30px] w-[30px] rounded-full",
                  color === value && "border-2 border-[var(--color-ink)]",
                )}
                style={{ background: value }}
              />
            ))}
          </div>
        </fieldset>
      )}

      {product.sizes.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[10px] text-[var(--color-muted)]">{t.product.sizes}</legend>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSize(value)}
                aria-pressed={size === value}
                className={cx(
                  "min-w-[44px] rounded-[12px] px-3 py-2 text-[11px] font-semibold",
                  size === value
                    ? "bg-[var(--color-brand)] text-white"
                    : "border border-[var(--color-outline)] text-[var(--color-ink)]",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {feedback && (
        <p
          role="status"
          className={cx(
            "text-[11px] font-semibold",
            feedback.kind === "ok" ? "text-[var(--color-brand)]" : "text-[var(--color-live)]",
          )}
        >
          {feedback.message}
        </p>
      )}

      {/* Barre d'action fixe, au-dessus de la zone sûre. */}
      <div className="pb-safe sticky bottom-0 -mx-4 mt-2 flex gap-[10px] border-t border-[var(--color-hairline)] bg-[var(--color-app)]/95 px-4 py-[14px] backdrop-blur">
        <Link
          href={`/boutique/${product.shopSlug}`}
          className="flex-1 rounded-[16px] border-[1.5px] border-[var(--color-brand)] py-3 text-center text-[13px] font-semibold text-[var(--color-brand)]"
        >
          {t.product.seeShop}
        </Link>
        <Button onClick={onAdd} disabled={pending || soldOut} className="flex-1">
          {soldOut ? t.product.outOfStock : pending ? t.common.loading : t.product.addToCart}
        </Button>
      </div>
    </>
  );
}
