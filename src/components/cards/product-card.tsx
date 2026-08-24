"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { toggleFavorite } from "@/app/actions/cart";
import { cx, formatPrice, percentOff } from "@/lib/format";
import { Placeholder } from "@/components/ui/primitives";
import { CartIcon, HeartIcon } from "@/components/ui/icons";
import { ImageZoom } from "@/components/ui/image-zoom";
import type { AppLocale } from "@/types/database";

export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
  stock: number;
  shop?: { name: string; slug: string } | null;
  category?: { hue: number } | null;
  /*
    Ni coloris ni images de variante ici.

    La carte ne montre plus qu'une photo, et les requêtes de liste ont été
    allégées en conséquence : `variant_images` est un document JSON qui peut
    porter six adresses par article, soit plusieurs kilo-octets multipliés par
    vingt-deux vignettes sur une grille — pour une donnée que plus rien
    n'affiche.
  */
}

/**
 * Vignette produit — carte flottante du thème « Halo ».
 *
 * La photo occupe presque toute la carte, sur un fond blanc à gros rayon ; le
 * nom et le prix vivent *sous* la carte, centrés. C'est ce qui permet à
 * l'image de respirer sur une grille à deux colonnes de trois cent
 * soixante-quinze pixels : le texte ne lui prend plus de hauteur.
 *
 * Trois repères se posent sur la photo plutôt qu'en dessous — la boutique, la
 * remise, le favori. Ils y sont lisibles parce qu'ils portent leur propre fond,
 * et ils libèrent la ligne de texte pour ce qui décide vraiment de l'achat.
 *
 * La carte n'est plus un lien unique. Elle en contenait un qui enveloppait
 * tout, ce qui interdisait d'y placer le moindre bouton — un contrôle
 * interactif ne peut pas vivre dans un lien. Les zones sont donc distinctes :
 * la photo s'agrandit, le nom ouvre la fiche, le cœur bascule le favori.
 */
export function ProductCard({
  product,
  locale = "fr",
  showShop = true,
  imageHeight = 132,
  isFavorite,
}: {
  product: ProductCardData;
  locale?: AppLocale;
  showShop?: boolean;
  imageHeight?: number;
  /**
   * Absent = pas de cœur du tout.
   *
   * L'afficher vide alors que l'article est déjà en favori serait pire que de
   * ne rien afficher : la personne le toucherait pour l'ajouter et le
   * retirerait. Les écrans qui n'interrogent pas les favoris n'en montrent
   * donc pas.
   */
  isFavorite?: boolean;
}) {
  const { t } = useI18n();
  const discount = percentOff(product.price, product.compare_at_price);
  const soldOut = product.stock === 0;

  /*
    La carte montre la première photo du produit, et rien d'autre.

    Elle a un temps porté une rangée de pastilles qui échangeait l'image sans
    quitter la grille. C'était joli et peu utile : à cent trente pixels de haut,
    un coloris ne se juge pas — on distingue une teinte, pas une matière — et la
    rangée de ronds pesait plus lourd à l'œil que le nom de l'article. Le choix
    du coloris se fait sur la fiche, où l'image est grande et porte son nom.
  */
  const cover = product.images?.[0];
  const srcs = product.images ?? [];

  const [favorite, setFavorite] = useState(Boolean(isFavorite));
  const [, startTransition] = useTransition();

  function onFavorite() {
    // Bascule optimiste : le cœur répond au doigt sans attendre le serveur, et
    // revient en arrière si l'écriture échoue.
    const previous = favorite;
    setFavorite(!previous);

    startTransition(async () => {
      const result = await toggleFavorite(product.id, previous);
      if (!result.ok) setFavorite(previous);
    });
  }

  return (
    <div className="flex flex-col">
      <div className="relative rounded-[24px] bg-[var(--color-surface-solid)] p-[7px] shadow-[0_10px_24px_rgba(60,40,90,0.09)]">
        {cover ? (
          /*
            Toucher la photo l'agrandit ; toucher le nom ouvre la fiche. Une
            vignette de cent trente pixels ne permet pas de juger une matière ou
            une couleur, et le client qui ouvrait la fiche pour cela perdait sa
            place dans la liste.
          */
          <ImageZoom images={srcs} alt={product.name} className="block w-full cursor-zoom-in">
            <span
              className="relative block w-full overflow-hidden rounded-[19px]"
              style={{ height: imageHeight }}
            >
              <Image
                src={cover}
                alt={product.name}
                fill
                sizes="(max-width: 520px) 50vw, 240px"
                className="fade-in-img object-cover"
              />
            </span>
          </ImageZoom>
        ) : (
          <Placeholder
            label="produit"
            className="w-full rounded-[19px]"
            style={{ height: imageHeight }}
          />
        )}

        {showShop && product.shop && (
          <span className="absolute start-[14px] top-[14px] max-w-[62%] truncate rounded-[10px] bg-[var(--color-surface-solid)]/96 px-2 py-1 text-[0.5625rem] font-bold text-[var(--color-ink)] shadow-[0_4px_10px_rgba(60,40,90,0.14)]">
            {product.shop.name}
          </span>
        )}

        {discount !== null && (
          <span className="absolute start-[14px] bottom-[14px] rounded-[10px] bg-[var(--color-brand-fill)] px-2 py-[3px] text-[0.53125rem] font-bold text-white">
            −{discount}%
          </span>
        )}

        {isFavorite !== undefined && (
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? t.product.unfavorite : t.product.favorite}
            className={cx(
              "press absolute end-[10px] top-[10px] flex h-[34px] w-[34px] items-center justify-center rounded-full",
              favorite ? "text-[var(--color-live)]" : "text-[var(--color-ink)]",
            )}
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--color-surface-solid)]/96 shadow-[0_4px_10px_rgba(60,40,90,0.16)]">
              <HeartIcon filled={favorite} size={13} />
            </span>
          </button>
        )}

        {/*
          La pastille d'achat, à cheval sur le bord de la carte.

          Elle mène à la fiche plutôt que d'ajouter au panier directement : un
          vêtement se commande dans une taille, et une ligne de panier sans
          taille est un problème pour le commerçant, pas pour le client. Le
          choix se fait donc là où les tailles s'affichent.

          La bordure reprend le fond de l'écran : c'est ce qui détache la
          pastille de la carte sans dessiner de contour.
        */}
        {!soldOut && (
          <Link
            href={`/produit/${product.id}`}
            aria-label={`${t.product.addToCart} — ${product.name}`}
            className="press absolute bottom-[-15px] start-1/2 flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-[var(--color-app)] bg-[var(--color-brand-fill)] text-white shadow-[0_10px_20px_rgba(109,75,143,0.36)] rtl:translate-x-1/2"
          >
            <CartIcon size={14} />
          </Link>
        )}

        {soldOut && (
          <span className="absolute end-[14px] bottom-[14px] rounded-[10px] bg-[rgba(36,31,46,0.72)] px-2 py-[3px] text-[0.53125rem] font-bold text-white">
            {t.product.outOfStock}
          </span>
        )}
      </div>

      <Link
        href={`/produit/${product.id}`}
        className={cx("block text-center", soldOut ? "pt-[10px]" : "pt-[22px]")}
      >
        <span className="line-clamp-2 block text-[0.71875rem] font-semibold text-[var(--color-ink)]">
          {product.name}
        </span>
        <span className="mt-[2px] block text-[0.8125rem] font-extrabold text-[var(--color-brand)]">
          {formatPrice(product.price, locale)}
          {product.compare_at_price && (
            <span className="ms-[6px] text-[0.625rem] font-normal text-[var(--color-faint)] line-through">
              {formatPrice(product.compare_at_price, locale)}
            </span>
          )}
        </span>
      </Link>

      {/*
        Plus de pastilles de couleur sous la carte.

        Elles promettaient un choix que la vignette ne peut pas tenir : à cent
        trente pixels, changer de coloris ne montre presque rien, et la rangée
        de ronds pesait visuellement plus lourd que le nom de l'article. La
        grille y gagne en calme, et le choix des coloris se fait où il a du sens
        — sur la fiche, en grand, avec le nom du coloris et son image.
      */}
    </div>
  );
}
