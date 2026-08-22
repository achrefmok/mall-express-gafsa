"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Placeholder } from "@/components/ui/primitives";
import { ImageZoom } from "@/components/ui/image-zoom";

export interface SponsoredSlot {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  /** Destination libre : une fiche produit, une boutique, un site externe. */
  link_url: string | null;
  shop_id: string | null;
  /** Jointe pour son `slug` : `/boutique/[slug]` n'accepte pas un identifiant. */
  shop: { slug: string; status: string } | null;
}

/**
 * Où mène cette publicité — et parfois, nulle part.
 *
 * Toutes ne rattachent pas à un commerce. Une affiche de festival, une annonce
 * municipale, une campagne d'un annonceur sans boutique : il n'y a rien à ouvrir
 * derrière, et fabriquer une destination de secours enverrait le visiteur sur
 * une page qui n'a aucun rapport avec ce qu'il vient de toucher.
 *
 * L'ordre suit la précision : une adresse explicite d'abord — elle peut viser un
 * article précis —, puis la boutique rattachée, puis rien.
 *
 * Une boutique suspendue est traitée comme absente : sa page ne s'ouvrirait pas,
 * et mieux vaut agrandir l'affiche que mener à un mur.
 */
function destination(slot: SponsoredSlot): string | null {
  if (slot.link_url) return slot.link_url;
  if (slot.shop?.slug && slot.shop.status === "approved") return `/boutique/${slot.shop.slug}`;
  return null;
}

const DELAY = 5000;
/** Après un geste, on laisse la main à la personne avant de reprendre. */
const RESUME_AFTER = 8000;

/**
 * Les publicités, en bannières que l'on fait défiler du doigt.
 *
 * Elles s'affichaient auparavant comme des produits : vignette de 96 pixels,
 * titre, sous-titre, cadre et ombre. Un annonceur qui paie une mise en avant
 * n'achète pas une fiche de plus dans une liste — il achète une image qu'on
 * regarde. La bannière prend donc toute la largeur, et le texte reste dans
 * l'image, là où le graphiste l'a placé.
 *
 * Le défilement est natif : `scroll-snap` et `overflow-x`. Aucune bibliothèque
 * de gestes, aucun écouteur de toucher à écrire — le navigateur fournit
 * l'inertie, le rebond aux extrémités, le sens de lecture arabe et le
 * défilement au trackpad. Une implémentation manuelle aurait perdu les quatre.
 *
 * L'automatisme s'efface devant le geste : dès que la personne touche le rail,
 * il s'arrête, et ne reprend qu'après huit secondes sans interaction. Lutter
 * contre un doigt qui fait défiler est la faute la plus commune de ces
 * composants.
 */
export function SponsoredCarousel({ slots }: { slots: SponsoredSlot[] }) {
  const { t } = useI18n();
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Le rang suit le défilement réel, jamais un compteur interne : c'est le seul
     moyen que les puces disent la vérité après un geste manuel. */
  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const width = rail.clientWidth || 1;
    setIndex(Math.round(Math.abs(rail.scrollLeft) / width));
  }, []);

  /* Toute interaction suspend l'automatisme, et arme sa reprise. */
  const hold = useCallback(() => {
    setPaused(true);
    if (resumeRef.current) clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => setPaused(false), RESUME_AFTER);
  }, []);

  useEffect(() => {
    if (slots.length < 2 || paused) return;

    /*
      Respecter un système réglé sur « animations réduites ».

      Une bannière qui glisse toute seule est exactement ce que ce réglage
      cherche à éviter, et il est souvent activé pour des raisons médicales.
    */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;

      const width = rail.clientWidth;
      const next = (index + 1) % slots.length;

      /*
        Le sens du défilement suit celui de la page. En arabe, `scrollLeft` est
        négatif : multiplier par le signe courant évite un carrousel qui part à
        l'envers sans que rien ne l'explique.
      */
      const direction = rail.scrollLeft < 0 || getComputedStyle(rail).direction === "rtl" ? -1 : 1;
      rail.scrollTo({ left: direction * next * width, behavior: "smooth" });
    }, DELAY);

    return () => clearInterval(timer);
  }, [index, paused, slots.length]);

  useEffect(() => {
    return () => {
      if (resumeRef.current) clearTimeout(resumeRef.current);
    };
  }, []);

  if (slots.length === 0) return null;

  return (
    <section aria-label={t.home.sponsored} className="flex flex-col gap-[6px]">
      <div
        ref={railRef}
        onScroll={onScroll}
        onPointerDown={hold}
        onTouchStart={hold}
        /*
          Le focus clavier arrête aussi le défilement. Une bannière qui change
          pendant qu'on la parcourt au clavier déplace la cible sous les doigts
          de quelqu'un qui ne peut pas la rattraper.
        */
        onFocusCapture={hold}
        className="no-sb flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {slots.map((slot) => {
          const href = destination(slot);

          const visuel = (
            <div className="relative overflow-hidden rounded-[20px] bg-[var(--color-track)]">
              {slot.image_url ? (
                <Image
                  src={slot.image_url}
                  alt={slot.title}
                  width={1040}
                  height={520}
                  sizes="(max-width: 520px) 100vw, 520px"
                  priority={slot.id === slots[0]?.id}
                  /*
                    Rapport 2:1, et l'image couvre. Une hauteur libre ferait
                    sauter la page pendant le chargement ; un `contain` laisserait
                    des bandes vides autour d'une bannière au mauvais format.
                  */
                  className="fade-in-img aspect-[2/1] w-full object-cover"
                />
              ) : (
                <Placeholder label="bannière — annonceur" className="aspect-[2/1] w-full" />
              )}

              {/*
                La mention légale, discrète mais présente : une publicité doit se
                dire telle. Posée sur l'image plutôt que sous elle, pour ne pas
                ajouter une ligne de texte à une section qui doit rester visuelle.
              */}
              <span className="absolute end-[10px] top-[10px] rounded-[4px] bg-[rgba(20,14,26,0.55)] px-[6px] py-[2px] text-[0.5rem] tracking-[0.025rem] text-white backdrop-blur-[2px]">
                {t.home.sponsoredBadge}
              </span>
            </div>
          );

          /*
            Deux comportements selon qu'il y ait quelque chose à ouvrir.

            Avec une destination, la bannière entière est le lien — un bouton
            « Voir » par-dessus une image de cette taille n'ajouterait qu'un
            endroit où ne pas toucher.

            Sans destination — une affiche de festival, une annonce municipale —
            le toucher agrandit l'image. C'est le seul geste qui apporte quelque
            chose : ces affiches portent leurs informations en petits caractères,
            précisément ce qu'on ne lit pas sur une bannière de la largeur d'un
            téléphone.
          */
          return (
            <div key={slot.id} className="w-full flex-none snap-center px-4">
              {href ? (
                <Link href={href} className="block">
                  {visuel}
                </Link>
              ) : slot.image_url ? (
                <ImageZoom
                  images={[slot.image_url]}
                  alt={slot.title}
                  className="block w-full cursor-zoom-in"
                >
                  {visuel}
                </ImageZoom>
              ) : (
                visuel
              )}

              {/*
                Le détail, seulement quand rien ne s'ouvre.

                Une publicité qui mène à une boutique n'a pas besoin d'être
                résumée : le clic donne mieux que deux lignes. Une affiche sans
                destination, si — c'est là que se trouvent la date et le lieu.
              */}
              {!href && (slot.title || slot.subtitle) && (
                <div className="px-1 pt-[6px]">
                  <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">{slot.title}</p>
                  {slot.subtitle && (
                    <p className="text-[0.65625rem] leading-[1.45] text-[var(--color-muted)]">
                      {slot.subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/*
        Les puces disent seulement combien il y a de bannières et où l'on en est.
        Elles ne sont pas cliquables : viser un point de six pixels au doigt est
        une promesse qu'on ne peut pas tenir, et le geste de défilement existe.
      */}
      {slots.length > 1 && (
        <div className="flex items-center justify-center gap-[10px] px-4">
          {/*
            Une commande de pause visible, en plus de l'arrêt au toucher.

            Un contenu qui défile tout seul doit pouvoir être arrêté volontairement
            et durablement : l'arrêt implicite reprend au bout de huit secondes,
            ce qui ne suffit pas à quelqu'un qui lit lentement, ou qui a simplement
            besoin que l'écran cesse de bouger.
          */}
          <button
            type="button"
            onClick={() => {
              if (resumeRef.current) clearTimeout(resumeRef.current);
              setPaused((p) => !p);
            }}
            aria-label={paused ? t.home.adsResume : t.home.adsPause}
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[0.625rem] leading-none text-[var(--color-muted)]"
          >
            {paused ? "▶" : "❚❚"}
          </button>

          <div className="flex gap-[5px]" aria-hidden>
          {slots.map((slot, i) => (
            <span
              key={slot.id}
              className="h-[5px] rounded-full transition-all duration-300 motion-reduce:transition-none"
              style={{
                width: i === index ? 16 : 5,
                background: i === index ? "var(--color-brand)" : "var(--color-hairline)",
              }}
            />
            ))}
          </div>

          {/* Le rang, dit à voix haute pour qui ne voit pas les puces. */}
          <span className="sr-only" aria-live="polite">
            {index + 1} / {slots.length}
          </span>
        </div>
      )}
    </section>
  );
}
