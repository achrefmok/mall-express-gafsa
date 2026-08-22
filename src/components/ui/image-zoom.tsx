"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Agrandir une image d'un toucher, la refermer d'un autre.
 *
 * Les vignettes du fil font cent pixels de haut. Sur un vêtement, une pièce
 * détachée ou l'étiquette de prix d'un bon plan, cela ne suffit pas à décider :
 * le client ouvrait la fiche pour regarder, revenait, et perdait sa place dans
 * la liste.
 *
 * Aucun bouton, et c'est délibéré. Une première version portait « Voir
 * l'article » et « Fermer » ; deux commandes de trop pour un geste qui n'en
 * demande aucune. On touche l'image, elle grandit. On touche encore, elle se
 * referme. Le seul cas qui justifie un contrôle est le passage d'une photo à la
 * suivante, et il ne se produit que si l'article en a plusieurs.
 */
export function ImageZoom({
  images,
  alt,
  className,
  startIndex = 0,
  children,
}: {
  /** Toutes les photos de l'article. La première est celle de la vignette. */
  images: string[];
  alt: string;
  className?: string;
  /**
   * Photo sur laquelle s'ouvrir. Une galerie passe le rang de la vignette
   * touchée : s'agrandir sur la première alors qu'on en regardait la troisième
   * donne l'impression d'avoir touché à côté.
   */
  startIndex?: number;
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
    toucher remontait jusqu'au lien pour déclencher la navigation. Ensuite la
    carte porte `transition-transform` : pendant l'appui, la transformation crée
    un repère de positionnement, et le plein écran se retrouvait enfermé dans une
    vignette de cent pixels.

    L'ouverture attend le montage : `document` n'existe pas au rendu serveur.
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
        aria-label={alt}
        onClick={(event) => {
          /*
            La vignette est presque toujours dans un lien vers la fiche. Sans ces
            deux arrêts, le toucher ouvrirait la page *et* la visionneuse, et
            l'agrandissement disparaîtrait pendant la navigation.
          */
          event.preventDefault();
          event.stopPropagation();
          setIndex(startIndex);
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>

      {open &&
        mounted &&
        createPortal(
          /*
            Toute la surface ferme.

            Un seul geste à connaître, et il n'y a rien à viser : où que le doigt
            tombe, la visionneuse se referme. Les deux flèches sont les seules
            exceptions, et elles arrêtent la propagation pour cela.

            L'arrêt de propagation sur la racine n'est pas une précaution
            superflue : un portail déplace le nœud dans le document, mais pas
            dans l'arbre React, et les événements de React remontent le long de
            l'arbre des composants. Sans lui, le clic ressortait dans le lien de
            la carte et ouvrait la fiche produit au lieu de fermer.
          */
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-[rgba(14,10,20,0.94)] p-4"
          >
            <Image
              src={images[index]}
              alt={alt}
              width={1200}
              height={1200}
              className="max-h-full w-auto max-w-full object-contain"
              sizes="100vw"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t.common.back}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIndex((i) => (i - 1 + images.length) % images.length);
                  }}
                  className="absolute start-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[1.25rem] leading-none text-white"
                >
                  ‹
                </button>

                <button
                  type="button"
                  aria-label={t.common.see}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIndex((i) => (i + 1) % images.length);
                  }}
                  className="absolute end-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[1.25rem] leading-none text-white"
                >
                  ›
                </button>

                {/* Le rang, pour savoir combien de photos restent à voir. */}
                <span className="pb-safe absolute bottom-4 text-[0.6875rem] font-semibold text-white/70">
                  {index + 1} / {images.length}
                </span>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
