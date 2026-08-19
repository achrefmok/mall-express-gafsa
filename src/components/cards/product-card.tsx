"use client";

import Link from "next/link";
import Image from "next/image";
import { formatPrice, percentOff } from "@/lib/format";
import { Placeholder } from "@/components/ui/primitives";
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
}

/**
 * Vignette produit de la grille marketplace.
 * Le filet de 2 px sous l'image porte la couleur de la catégorie : c'est le
 * seul repère chromatique de la grille, il doit rester lisible.
 */
export function ProductCard({
  product,
  locale = "fr",
  showShop = true,
  imageHeight = 110,
}: {
  product: ProductCardData;
  locale?: AppLocale;
  showShop?: boolean;
  imageHeight?: number;
}) {
  const discount = percentOff(product.price, product.compare_at_price);
  const cover = product.images?.[0];
  const hue = product.category?.hue ?? 300;

  return (
    <Link
      href={`/produit/${product.id}`}
      className="relative overflow-hidden rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-transform active:scale-[0.985]"
    >
      {discount !== null && (
        <span className="absolute start-2 top-2 z-10 rounded-[3px] bg-[var(--color-live)] px-[6px] py-[2px] text-[8px] font-bold text-white">
          −{discount}%
        </span>
      )}

      {product.stock === 0 && (
        <span className="absolute end-2 top-2 z-10 rounded-[3px] bg-[rgba(36,31,46,0.72)] px-[6px] py-[2px] text-[8px] font-bold text-white">
          0
        </span>
      )}

      {cover ? (
        /*
          Toucher la photo l'agrandit ; toucher le nom ou le prix ouvre la
          fiche. Une vignette de cent pixels ne permet pas de juger une matière
          ou une couleur, et le client qui ouvrait la fiche pour cela perdait sa
          place dans la liste. Le reste de la carte reste cliquable : le chemin
          vers l'achat n'est pas retiré, il est simplement déplacé de deux
          centimètres.
        */
        <ImageZoom
          images={product.images}
          alt={product.name}
          className="block w-full cursor-zoom-in"
        >
          <Image
            src={cover}
            alt={product.name}
            width={200}
            height={imageHeight}
            sizes="(max-width: 520px) 50vw, 240px"
            className="w-full object-cover"
            style={{ height: imageHeight }}
          />
        </ImageZoom>
      ) : (
        <Placeholder label="produit" className="w-full" style={{ height: imageHeight }} />
      )}

      <div className="h-[2px] cat-rule" style={{ "--hue": hue } as React.CSSProperties} />

      <div className="p-[9px]">
        <p className="line-clamp-2 text-[11px] font-semibold text-[var(--color-ink)]">{product.name}</p>
        {showShop && product.shop && (
          <p className="truncate text-[10px] text-[var(--color-muted)]">{product.shop.name}</p>
        )}
        <p className="mt-1 text-[12px] font-bold text-[var(--color-brand)]">
          {formatPrice(product.price, locale)}
          {product.compare_at_price && (
            <span className="ms-[6px] text-[10px] font-normal text-[var(--color-faint)] line-through">
              {formatPrice(product.compare_at_price, locale)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
