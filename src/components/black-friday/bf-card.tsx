import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { lienProduit } from "@/lib/product-url";
import type { OffreVitrine } from "@/lib/black-friday-server";
import type { AppLocale } from "@/types/database";
import { getT } from "@/lib/i18n/server";

/**
 * Une offre Black Friday, en carte.
 *
 * Composant serveur, sans le moindre JavaScript envoyé au navigateur : la
 * section de l'accueil en affiche une rangée, et chaque kilo-octet de plus y
 * serait payé par tous les visiteurs, acheteurs ou non.
 *
 * L'ordre de lecture est celui de la décision : la remise d'abord — c'est ce
 * qui fait s'arrêter —, puis l'image, puis le prix, puis la boutique.
 */
export async function CarteBlackFriday({
  offre,
  locale,
  priorite = false,
}: {
  offre: OffreVitrine;
  locale: AppLocale;
  /** Pour les premières cartes visibles : l'image se charge sans attendre. */
  priorite?: boolean;
}) {
  const { t } = await getT();
  const epuise = offre.stock <= 0;

  return (
    <Link
      href={lienProduit({ id: offre.produit.id, name: offre.produit.name })}
      className="press group flex w-[156px] flex-none flex-col overflow-hidden rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] shadow-[var(--shadow-card)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--color-track)]">
        {offre.produit.image && (
          /*
            156 px affichés, donc une source à la mesure — `sizes` le dit à
            l'optimiseur, qui sert une miniature en AVIF ou WebP plutôt que la
            photo d'origine de 2 560 px. C'est l'essentiel du poids d'une
            rangée de cartes.
          */
          <Image
            src={offre.produit.image}
            alt=""
            fill
            sizes="156px"
            priority={priorite}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}

        {offre.reduction !== null && (
          <span className="absolute start-2 top-2 rounded-full bg-[#111] px-2 py-[3px] text-[0.75rem] font-extrabold tracking-tight text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <span dir="ltr">−{offre.reduction}%</span>
          </span>
        )}

        {epuise && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[0.625rem] font-bold text-white">
            {t.bf.soldOut}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-[3px] p-[10px]">
        <p className="line-clamp-2 min-h-[2.4em] text-[0.71875rem] leading-[1.2] font-semibold text-[var(--color-ink)]">
          {offre.produit.name}
        </p>

        <div className="flex flex-wrap items-baseline gap-x-[6px]">
          <span className="text-[0.9375rem] font-extrabold text-[var(--color-ink)]">
            {formatPrice(offre.prixBf, locale)}
          </span>
          <span className="text-[0.625rem] text-[var(--color-faint)] line-through">
            {formatPrice(offre.prixNormal, locale)}
          </span>
        </div>

        <p className="truncate text-[0.59375rem] font-semibold text-[var(--color-muted)]">
          {offre.boutique.name}
        </p>
      </div>
    </Link>
  );
}
