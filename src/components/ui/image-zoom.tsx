"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Agrandir une image d'un toucher, la refermer d'un autre.
 *
 * Les vignettes du fil font cent pixels de haut. Sur un vêtement, une pièce
 * détachée ou l'étiquette de prix d'un bon plan, cela ne suffit pas à décider :
 * le client ouvrait la fiche pour regarder, revenait, et perdait sa place dans
 * la liste.
 *
 * En plein écran, trois gestes : pincer pour agrandir, double-toucher pour
 * basculer entre la vue d'ensemble et le détail, glisser pour se déplacer une
 * fois agrandi. Un toucher simple referme — mais seulement à l'échelle 1, sinon
 * on refermerait la visionneuse en voulant relâcher un déplacement.
 */

/** Échelle atteinte au double-toucher, et plafond du pincement. */
const ZOOM_DOUBLE = 2.5;
const ZOOM_MAX = 4;

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
  const [index, setIndex] = useState(startIndex);

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
          <Visionneuse
            images={images}
            alt={alt}
            index={index}
            setIndex={setIndex}
            close={close}
            labels={{ back: t.common.back, next: t.common.see }}
          />,
          document.body,
        )}
    </>
  );
}

function Visionneuse({
  images,
  alt,
  index,
  setIndex,
  close,
  labels,
}: {
  images: string[];
  alt: string;
  index: number;
  setIndex: (fn: (i: number) => number) => void;
  close: () => void;
  labels: { back: string; next: string };
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  /*
    Les pointeurs actifs, et l'état du geste en cours.

    Des `ref` plutôt que des `state` : ces valeurs changent à chaque événement de
    déplacement, et déclencher un rendu à chaque fois rendrait le pincement
    saccadé sur un téléphone d'entrée de gamme. Seuls l'échelle et le décalage —
    ce qui se voit — passent par l'état.
  */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Changer de photo repart de la vue d'ensemble : rester agrandi sur une zone
  // choisie pour l'image précédente n'a aucun sens.
  useEffect(reset, [index, reset]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onPointerDown(event: React.PointerEvent) {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;

    if (pointers.current.size === 2) {
      gesture.current = { distance: distance(), scale };
      pan.current = null;
    } else if (scale > 1) {
      pan.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      moved.current = true;
      const facteur = distance() / (gesture.current.distance || 1);
      setScale(Math.min(ZOOM_MAX, Math.max(1, gesture.current.scale * facteur)));
      return;
    }

    if (pan.current && scale > 1) {
      const dx = event.clientX - pan.current.x;
      const dy = event.clientY - pan.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      setOffset({ x: pan.current.ox + dx, y: pan.current.oy + dy });
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) pan.current = null;

    // Revenu sous l'échelle 1 : on recentre plutôt que de laisser l'image
    // flotter hors de son cadre.
    if (scale <= 1.02) reset();

    if (moved.current) return;

    const maintenant = Date.now();
    if (maintenant - lastTap.current < 280) {
      lastTap.current = 0;
      setScale((s) => (s > 1.05 ? 1 : ZOOM_DOUBLE));
      setOffset({ x: 0, y: 0 });
      return;
    }
    lastTap.current = maintenant;

    /*
      Le toucher simple ne referme qu'à l'échelle 1.

      Agrandi, on relâche constamment le doigt en déplaçant l'image : refermer à
      ce moment-là ferait perdre la vue qu'on venait de cadrer.
    */
    if (scale <= 1.02) {
      window.setTimeout(() => {
        if (lastTap.current !== 0) close();
      }, 280);
    }
  }

  return (
    /*
      Toute la surface ferme.

      L'arrêt de propagation n'est pas une précaution superflue : un portail
      déplace le nœud dans le document, mais pas dans l'arbre React, et les
      événements de React remontent le long de l'arbre des composants. Sans lui,
      le clic ressortait dans le lien de la carte et ouvrait la fiche produit au
      lieu de fermer.
    */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="fixed inset-0 z-[90] flex touch-none items-center justify-center overflow-hidden bg-[rgba(14,10,20,0.94)] p-4"
      style={{ cursor: scale > 1 ? "grab" : "zoom-out" }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition: pan.current || gesture.current ? "none" : "transform 220ms ease-out",
        }}
      >
        {/*
          La définition suit l'agrandissement, et seulement lui.

          Au repos, l'image occupe la largeur de l'écran : cent pour cent de la
          fenêtre suffisent, et c'est ce qu'on charge. Dès que le doigt écarte,
          l'élément est étiré par une transformation — les pixels, eux, ne se
          multiplient pas, et l'on voit la trame.

          On annonce donc au navigateur une largeur proportionnelle au
          grossissement : il va rechercher une définition supérieure, une seule
          fois, au moment précis où elle sert. Ouvrir la visionneuse ne coûte
          rien de plus qu'avant ; c'est le pincement qui paie ce qu'il demande.

          `width` et `height` ne servent qu'à réserver un rapport de forme le
          temps du chargement : `object-contain` rend ensuite les proportions
          réelles du fichier, quelles qu'elles soient.
        */}
        <Image
          src={images[index]}
          alt={alt}
          width={1600}
          height={1600}
          className="max-h-full w-auto max-w-full object-contain"
          sizes={`${Math.round(Math.min(scale, ZOOM_MAX) * 100)}vw`}
          quality={92}
          priority
          draggable={false}
        />
      </div>

      {images.length > 1 && scale <= 1.02 && (
        <>
          <button
            type="button"
            aria-label={labels.back}
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
            aria-label={labels.next}
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
    </div>
  );
}
