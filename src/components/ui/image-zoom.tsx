"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Agrandir une image d'un toucher.
 *
 * Les vignettes du fil font cent pixels de haut. Sur une photo de vêtement ou
 * de pièce détachée, cela ne suffit pas à décider : le client veut voir la
 * matière, la couleur exacte, l'état. Sans agrandissement, il ouvre la fiche,
 * regarde, revient — et perd le fil de ce qu'il parcourait.
 *
 * Deux précautions rendent le geste sûr là où la vignette est déjà cliquable :
 *
 *   · `preventDefault` et `stopPropagation` sur le déclencheur. Ces images
 *     vivent souvent dans un lien qui mène à la fiche ; sans cela, le toucher
 *     ouvrirait la page *et* la visionneuse, et l'on verrait l'agrandissement
 *     disparaître pendant la navigation.
 *   · un lien vers la fiche à l'intérieur de la visionneuse. On retire l'accès
 *     que la vignette offrait, il faut le rendre — sinon regarder de plus près
 *     revient à s'éloigner de l'achat.
 *
 * Plusieurs images sont acceptées : le vendeur peut en déposer six, et les
 * parcourir depuis l'agrandissement évite d'ouvrir la fiche pour comparer deux
 * angles du même article.
 */
export function ImageZoom({
  images,
  alt,
  href,
  linkLabel,
  className,
  children,
}: {
  /** Toutes les photos de l'article. La première est celle de la vignette. */
  images: string[];
  alt: string;
  /** Fiche à proposer depuis la visionneuse, si la vignette y menait. */
  href?: string;
  linkLabel?: string;
  className?: string;
  /** La vignette elle-même, rendue par l'appelant. */
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  /*
    Rendue dans le corps du document, jamais sur place.

    Deux raisons, et chacune suffirait. D'abord la vignette vit dans un lien :
    rendue au même endroit, la visionneuse en devenait un enfant, et le moindre
    toucher — « Fermer » compris — remontait jusqu'au lien et déclenchait la
    navigation. Ensuite la carte porte `transition-transform` : pendant l'appui,
    la transformation crée un repère de positionnement, et le plein écran se
    retrouvait enfermé dans une vignette de cent pixels.

    Le portail règle les deux d'un coup — l'ouverture n'est possible qu'une fois
    le composant monté, `document` n'existant pas au rendu serveur.
  */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (event.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };

    /*
      Le fond ne défile plus tant que la visionneuse est ouverte. Sur téléphone,
      un glissement destiné à l'image ferait sinon défiler la page derrière, et
      l'on retrouve la liste à un endroit qu'on n'a pas choisi.
    */
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, images.length]);

  if (images.length === 0) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        aria-label={t.common.see}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIndex(0);
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>

      {open &&
        mounted &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          /*
            Ceinture et bretelles : même hors du lien, un clic qui remonterait
            jusqu'à un gestionnaire de la page n'a rien à y faire.
          */
          onClick={(event) => event.stopPropagation()}
          className="fixed inset-0 z-[90] flex flex-col bg-[rgba(14,10,20,0.94)]"
        >
          {/* Le fond ferme au toucher : c'est le geste attendu d'une visionneuse. */}
          <button
            type="button"
            aria-label={t.common.close}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-zoom-out"
          />

          {/*
            Une croix en haut à droite, en plus du fond et du bouton du bas.

            Trois sorties pour une seule porte, et ce n'est pas de trop : le
            bouton du bas peut passer sous la barre d'adresse d'un navigateur
            mobile, et toucher le fond ne se devine pas. Une visionneuse dont on
            ne sait pas sortir est un piège, pas une fonctionnalité.
          */}
          <button
            type="button"
            aria-label={t.common.close}
            onClick={close}
            className="pt-safe absolute end-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-[18px] leading-none text-white backdrop-blur-sm"
          >
            ✕
          </button>

          <div className="pointer-events-none relative flex flex-1 items-center justify-center p-4">
            <Image
              src={images[index]}
              alt={alt}
              width={1200}
              height={1200}
              className="max-h-full w-auto max-w-full object-contain"
              sizes="100vw"
            />
          </div>

          <div className="pb-safe relative flex flex-none items-center justify-center gap-2 p-4">
            {images.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t.common.back}
                  onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                  className="rounded-full bg-white/15 px-3 py-2 text-[13px] font-bold text-white"
                >
                  ‹
                </button>
                <span className="text-[11px] font-semibold text-white/80">
                  {index + 1} / {images.length}
                </span>
                <button
                  type="button"
                  aria-label={t.common.see}
                  onClick={() => setIndex((i) => (i + 1) % images.length)}
                  className="rounded-full bg-white/15 px-3 py-2 text-[13px] font-bold text-white"
                >
                  ›
                </button>
              </div>
            )}

            {href && (
              <Link
                href={href}
                className="ms-2 rounded-[14px] bg-white px-4 py-2 text-[11.5px] font-bold text-[var(--color-ink)]"
              >
                {linkLabel ?? t.common.see}
              </Link>
            )}

            <button
              type="button"
              onClick={close}
              className="rounded-[14px] border border-white/30 px-4 py-2 text-[11.5px] font-semibold text-white"
            >
              {t.common.close}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
