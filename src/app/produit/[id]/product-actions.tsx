"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { colorName } from "@/lib/color-names";
import { addToCart, toggleFavorite } from "@/app/actions/cart";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { CartIcon, HeartIcon, ShareIcon, StoreIcon } from "@/components/ui/icons";
import { BackButton } from "@/components/shell/back";
import { useVariant } from "@/components/products/variant-context";

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

  /*
    Trois pastilles posées sur la photo, plutôt qu'une barre au-dessus.

    La barre occupait cinquante pixels de haut sur l'écran où l'image *est*
    l'argument de vente. En pastilles blanches à trente-quatre pixels, les
    commandes restent visibles sur n'importe quelle photo — c'est leur fond qui
    les détache, pas un bandeau — et la photo récupère toute la hauteur.
  */
  const pastille =
    "press flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-surface-solid)]/94 shadow-[0_6px_14px_rgba(60,40,90,0.14)] backdrop-blur-[2px]";

  return (
    <header className="absolute inset-x-[14px] top-3 z-10 flex items-center justify-between">
      {/*
        Repli sur la marketplace quand rien ne précède dans l'application.

        `router.back()` seul remontait l'historique du navigateur : un visiteur
        venu d'un lien partagé, d'une recherche Google ou de la page de
        présentation se retrouvait renvoyé là, alors que la flèche signifiait pour
        lui « revenir à la liste des produits ».
      */}
      <BackButton fallback="/marketplace" className={cx(pastille, "text-[var(--color-ink)]")} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? t.product.unfavorite : t.product.favorite}
          className={cx(
            pastille,
            favorite ? "text-[var(--color-live)]" : "text-[var(--color-ink)]",
          )}
        >
          <HeartIcon filled={favorite} size={15} />
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label={t.common.share}
          className={cx(pastille, "text-[var(--color-ink)]")}
        >
          <ShareIcon size={15} />
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

  /*
    La couleur vient du contexte, pas d'un état local.

    Le choix se fait dans la galerie, en haut de la fiche ; c'est ici qu'il part
    au panier. Un état local aurait laissé les deux se contredire dès le premier
    toucher — la photo montrant une couleur, le panier en enregistrant une autre.
  */
  const { color } = useVariant();
  const [size, setSize] = useState<string | null>(product.sizes[0] ?? null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const soldOut = product.stock <= 0;

  function onAdd() {
    setFeedback(null);

    startTransition(async () => {
      const result = await addToCart({ productId: product.id, color, size });

      if (result.ok) {
        setFeedback({ kind: "ok", message: t.product.added });
        setAdded(true);
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
      {/*
        Plus de rangée de pastilles ici.

        Le choix se fait sur la photo, en arc autour du produit, là où le
        changement se voit. Répéter les mêmes pastilles juste avant le bouton
        d'achat en faisait un formulaire à remplir, et donnait deux endroits pour
        décider d'une même chose — celui du haut montrant le résultat, celui du
        bas ne montrant rien.

        Ne reste que la confirmation de ce qui partira au panier : à cet endroit
        de la fiche, la question n'est plus « quelle couleur ? » mais « laquelle
        ai-je prise ? ».
      */}
      {color && product.colors.length > 1 && (
        <p className="mt-1 flex items-center gap-2 text-[0.6875rem] font-semibold text-[var(--color-ink)]">
          <span
            aria-hidden
            className="h-[15px] w-[15px] flex-none rounded-full ring-1 ring-[var(--color-outline)]"
            style={{ background: color }}
          />
          {colorName(color, t) ??
            format(t.product.colorOf, {
              i: product.colors.indexOf(color) + 1,
              n: product.colors.length,
            })}
        </p>
      )}

      {product.sizes.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[0.625rem] text-[var(--color-muted)]">{t.product.sizes}</legend>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSize(value)}
                aria-pressed={size === value}
                className={cx(
                  "min-w-[44px] rounded-[12px] px-3 py-2 text-[0.6875rem] font-semibold",
                  size === value
                    ? "bg-[var(--color-brand-fill)] text-white"
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
            "text-[0.6875rem] font-semibold",
            feedback.kind === "ok" ? "text-[var(--color-brand)]" : "text-[var(--color-live)]",
          )}
        >
          {feedback.message}
        </p>
      )}

      {/*
        Barre d'action fixe, au-dessus de la zone sûre.

        Le second bouton change après un ajout réussi : « Voir la boutique »
        laisse la place à « Voir le panier ». Rien ne menait à la caisse
        auparavant — un texte « Ajouté » s'affichait, puis plus rien, et il
        fallait retrouver seul la petite icône en haut de l'écran.

        Le bouton est remplacé plutôt qu'ajouté : une fois l'article dans le
        panier, poursuivre vers la caisse importe davantage que visiter la
        boutique, et une barre à trois commandes sur un téléphone n'aide
        personne. La boutique reste accessible par son nom, en haut de la fiche.
      */}
      <div className="pb-safe sticky bottom-0 -mx-4 mt-2 flex items-center gap-[10px] border-t border-[var(--color-hairline)] bg-[var(--color-app)]/95 px-4 py-[14px] backdrop-blur">
        {/*
          L'action secondaire devient une pastille ronde : le bouton d'achat
          récupère toute la largeur restante.

          Deux boutons de même taille se disputaient le regard, alors qu'un seul
          des deux fait vendre. La pastille garde l'accès à la boutique sans le
          revendiquer — et ses quarante pixels restent au-dessus du minimum
          tactile.
        */}
        <Link
          href={added ? "/panier" : `/boutique/${product.shopSlug}`}
          aria-label={added ? t.product.goToCart : t.product.seeShop}
          className="press flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[var(--color-brand)] text-[var(--color-brand)]"
        >
          {added ? <CartIcon size={17} /> : <StoreIcon size={17} />}
        </Link>
        <Button onClick={onAdd} disabled={pending || soldOut} className="flex-1 rounded-[22px]">
          {soldOut ? t.product.outOfStock : pending ? t.common.loading : t.product.addToCart}
        </Button>
      </div>
    </>
  );
}
