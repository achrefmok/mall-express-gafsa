"use client";

import Image from "next/image";
import { AnimatePresence, LazyMotion, m } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { cx } from "@/lib/format";
import { galleryFor, variantOf } from "@/lib/variants";
import { Placeholder } from "@/components/ui/primitives";
import { ImageZoom } from "@/components/ui/image-zoom";
import { useVariant } from "./variant-context";

/*
  Les fonctions d'animation sont chargées après la page, pas avec elle.

  Importées statiquement, elles ajoutaient trente-deux kilo-octets au paquet de
  la fiche produit — la page d'atterrissage depuis Google, sur un marché où la
  donnée mobile se paie. Passée en fonction, la dépendance devient un fragment
  séparé que le navigateur va chercher une fois la page affichée : le contour
  des miniatures apparaît sans transition pendant les premières centaines de
  millisecondes, puis glisse normalement. Personne ne remarque l'un, tout le
  monde subissait l'autre.
*/
const chargerAnimations = () => import("framer-motion").then((mod) => mod.domAnimation);

/**
 * Les photos d'un article : une grande, des miniatures, et la couleur choisie.
 *
 * Le défilement reste natif — `scroll-snap` et `overflow-x` — comme le
 * carrousel de l'accueil : le navigateur fournit l'inertie, le rebond aux
 * extrémités et le sens de lecture arabe. Aucun écouteur de geste à écrire, et
 * rien à réimplémenter pour le clavier ou le trackpad.
 *
 * Les miniatures s'ajoutent au glissement, elles ne le remplacent pas. Sur une
 * fiche à cinq photos, glisser cinq fois pour revenir à la première est une
 * corvée ; toucher la vignette voulue ne l'est pas. Elles remplacent les puces,
 * qui disaient la même chose en montrant moins.
 *
 * Quand une couleur est choisie et qu'une photo lui correspond, cette photo
 * passe en tête et la galerie s'y repositionne. Les autres vues — le dos, une
 * vue portée, l'étiquette — restent accessibles derrière : elles valent pour
 * toutes les couleurs.
 */
export function ProductGallery({ alt }: { alt: string }) {
  const { t } = useI18n();
  const { images, variantImages, color } = useVariant();

  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const shown = galleryFor(images, variantImages, color);
  const entry = variantOf(variantImages, color);

  /* Le rang suit le défilement réel : c'est le seul moyen que les miniatures
     disent la vérité après un geste manuel. */
  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const width = rail.clientWidth || 1;
    setIndex(Math.round(Math.abs(rail.scrollLeft) / width));
  }, []);

  /*
    Changer de couleur ramène en tête.

    Sans cela, quelqu'un arrêté sur la troisième photo qui touche « bleu »
    resterait sur une vue générale : la photo bleue serait passée en première
    position, hors de l'écran. Le geste n'aurait produit aucun effet visible.
  */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !entry?.url) return;

    rail.scrollTo({ left: 0, behavior: "smooth" });
    setIndex(0);
  }, [entry?.url]);

  const goTo = useCallback((i: number) => {
    const rail = railRef.current;
    if (!rail) return;

    const width = rail.clientWidth;
    const direction = rail.scrollLeft < 0 || getComputedStyle(rail).direction === "rtl" ? -1 : 1;
    rail.scrollTo({ left: direction * i * width, behavior: "smooth" });
  }, []);

  if (shown.length === 0) {
    return (
      <Placeholder
        label="photo produit — pleine largeur"
        className="h-[286px] w-full flex-none rounded-b-[30px] lg:h-[420px] lg:rounded-[18px]"
      />
    );
  }

  /*
    Le cadre impose la hauteur, l'image le remplit.

    Déclarer une largeur et une hauteur reviendrait à annoncer un rapport que le
    rendu ne tient pas : la photo est recadrée en `cover` sur une hauteur fixe,
    quel que soit son format d'origine.
  */
  const slide = (src: string, i: number) => (
    <span className="relative block h-[286px] w-full lg:h-[420px]">
      <Image
        src={src}
        alt={shown.length > 1 ? format(t.product.photoOf, { i: i + 1, n: shown.length }) : alt}
        fill
        sizes="(max-width: 520px) 100vw, 420px"
        priority={i === 0}
        className="fade-in-img object-cover"
      />
    </span>
  );

  return (
    <LazyMotion features={chargerAnimations} strict>
      <div className="flex flex-none flex-col gap-2">
        <div className="relative overflow-hidden rounded-b-[30px] lg:rounded-[18px]">
          <div
            ref={railRef}
            onScroll={onScroll}
            className="no-sb flex snap-x snap-mandatory overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {shown.map((src, i) => (
              <ImageZoom
                key={src}
                images={shown}
                alt={alt}
                startIndex={i}
                className="w-full flex-none snap-center cursor-zoom-in"
              >
                {slide(src, i)}
              </ImageZoom>
            ))}
          </div>

          {/*
            L'aveu, quand la photo n'en est pas une.

            Une teinte fabriquée approche la couleur, elle ne montre pas
            l'article dans cette couleur : la matière, les coutures et les
            reflets restent ceux du modèle d'origine. Le dire est la condition
            pour s'autoriser à la produire — quelqu'un qui commande sur une image
            doit savoir ce qu'il regarde.
          */}
          <AnimatePresence>
            {entry?.generated && index === 0 && (
              <m.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                className="pointer-events-none absolute start-3 bottom-3 rounded-[10px] bg-[rgba(20,14,26,0.72)] px-[9px] py-1 text-[0.53125rem] font-bold text-white backdrop-blur-[2px]"
              >
                {t.product.generatedImage}
              </m.span>
            )}
          </AnimatePresence>
        </div>

        {/*
          Les miniatures, seulement s'il y a un choix à faire.

          Une seule photo n'a pas besoin d'être choisie ; une rangée d'une
          vignette ne serait qu'une ligne de plus à ignorer.
        */}
        {shown.length > 1 && (
          <div className="no-sb flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
            {shown.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={format(t.product.photoOf, { i: i + 1, n: shown.length })}
                aria-current={i === index ? "true" : undefined}
                className="press relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[14px]"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="52px"
                  className={cx(
                    "object-cover transition-opacity",
                    i === index ? "opacity-100" : "opacity-55",
                  )}
                />
                {/*
                  Le contour glisse d'une vignette à l'autre au lieu de
                  disparaître ici pour réapparaître là : l'œil suit le
                  déplacement et comprend qu'il s'agit du même repère. C'est
                  ce qu'une transition partagée fait bien, et ce qu'une
                  transition CSS ne sait pas faire entre deux éléments.
                */}
                {i === index && (
                  <m.span
                    layoutId="miniature-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="pointer-events-none absolute inset-0 rounded-[14px] ring-2 ring-[var(--color-brand)] ring-inset"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </LazyMotion>
  );
}
