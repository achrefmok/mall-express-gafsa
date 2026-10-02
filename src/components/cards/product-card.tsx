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
import { lienProduit } from "@/lib/product-url";
import { bfEnVigueur, pourcentageReduction, type PrixBf } from "@/lib/black-friday";

export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
  stock: number;
  shop?: { name: string; slug: string } | null;
  category?: { hue: number } | null;
  /**
   * L'offre Black Friday du produit, posée par `avecBlackFriday` côté
   * serveur. Absente ou nulle : la carte reste celle de tous les jours.
   */
  bf?: PrixBf | null;
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
 * la photo s'agrandit, le nom ouvre la fiche, la pastille boutique ouvre la
 * boutique, le cœur bascule le favori.
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
  const soldOut = product.stock === 0;

  /*
    Le Black Friday, quand il est en vigueur.

    Le prix vient du serveur (`avecBlackFriday`, la règle de `place_order`) ;
    la carte ne fait que vérifier l'heure, pour qu'une page restée en cache
    ne montre pas une offre terminée. L'heure est lue une fois au montage :
    la relire à chaque rendu ferait changer la carte entre le serveur et le
    navigateur au moindre re-rendu.

    Pendant l'offre, l'ancien prix barré est le prix normal — pas le
    `compare_at_price` : c'est la baisse du jour qu'on annonce, et c'est elle
    que le client paiera.
  */
  const [maintenant] = useState(() => Date.now());
  const bf = bfEnVigueur(product.bf, maintenant) ? product.bf : null;
  const reductionBf = bf ? pourcentageReduction(product.price, bf.prix) : null;

  const discount = bf ? reductionBf : percentOff(product.price, product.compare_at_price);
  const prixAffiche = bf ? bf.prix : product.price;
  const prixBarre = bf ? product.price : product.compare_at_price;

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
      {/*
        Le rayon se lit dans `--pc-rayon` / `--pc-rayon-interieur`, posées par
        la page boutique selon le thème de la catégorie (voir
        `src/lib/boutique-themes.ts`). Sans ancêtre qui les définit — partout
        ailleurs dans l'application — les valeurs de repli reproduisent
        exactement l'apparence d'avant : rien ne change pour ces écrans-là.
      */}
      <div className="relative rounded-[var(--pc-rayon,24px)] bg-[var(--color-surface-solid)] p-[7px] shadow-[0_10px_24px_rgba(60,40,90,0.09)]">
        {cover ? (
          /*
            Toucher la photo l'agrandit ; toucher le nom ouvre la fiche. Une
            vignette de cent trente pixels ne permet pas de juger une matière ou
            une couleur, et le client qui ouvrait la fiche pour cela perdait sa
            place dans la liste.
          */
          <ImageZoom images={srcs} alt={product.name} className="block w-full cursor-zoom-in">
            <span
              className="relative block w-full overflow-hidden rounded-[var(--pc-rayon-interieur,19px)]"
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
            className="w-full rounded-[var(--pc-rayon-interieur,19px)]"
            style={{ height: imageHeight }}
          />
        )}

        {showShop && product.shop && !bf && (
          <Link
            href={`/boutique/${product.shop.slug}`}
            className="press absolute start-[14px] top-[14px] max-w-[62%] truncate rounded-[10px] bg-[var(--color-surface-solid)]/96 px-2 py-1 text-[0.5625rem] font-bold text-[var(--color-ink)] shadow-[0_4px_10px_rgba(60,40,90,0.14)]"
          >
            {product.shop.name}
          </Link>
        )}

        {discount !== null && (
          <span
            className={cx(
              "absolute start-[14px] bottom-[14px] rounded-[10px] px-2 py-[3px] font-bold text-white",
              bf
                ? "bg-[#111] text-[0.625rem] font-extrabold shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                : "bg-[var(--theme-accent,var(--color-brand-fill))] text-[0.53125rem]",
            )}
          >
            {bf && <span aria-hidden>🔥 </span>}
            <span dir="ltr">−{discount}%</span>
          </span>
        )}

        {/* Le bandeau Black Friday, là où la boutique s'affiche d'habitude. */}
        {bf && (
          <span className="absolute start-[14px] top-[14px] rounded-[10px] bg-[linear-gradient(135deg,#0d0b10,#5a3a78)] px-2 py-1 text-[0.5rem] font-extrabold tracking-[0.08em] text-white uppercase shadow-[0_4px_10px_rgba(13,11,16,0.3)]">
            {t.bf.badge}
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
            href={lienProduit(product)}
            aria-label={`${t.product.addToCart} — ${product.name}`}
            className="press absolute bottom-[-15px] start-1/2 flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-[var(--color-app)] bg-[var(--theme-accent,var(--color-brand-fill))] text-[var(--theme-accent-texte,white)] shadow-[0_10px_20px_rgba(109,75,143,0.36)] rtl:translate-x-1/2"
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
        href={lienProduit(product)}
        className={cx("block text-center", soldOut ? "pt-[10px]" : "pt-[22px]")}
      >
        <span className="line-clamp-2 block text-[0.71875rem] font-semibold text-[var(--color-ink)]">
          {product.name}
        </span>
        <span
          className={cx(
            "mt-[2px] block text-[0.8125rem] font-extrabold",
            bf ? "text-[var(--color-ink)]" : "text-[var(--theme-accent-fort,var(--color-brand))]",
          )}
        >
          {prixBarre && (
            <span className="me-[6px] text-[0.625rem] font-normal text-[var(--color-faint)] line-through">
              {formatPrice(prixBarre, locale)}
            </span>
          )}
          {bf && <span className="sr-only">{t.bf.nowAt} </span>}
          {formatPrice(prixAffiche, locale)}
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
