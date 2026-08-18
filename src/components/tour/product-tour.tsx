"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/*
  Le guide s'accroche à des repères posés dans le balisage — `data-tour="…"` —
  et non à des classes ou à des positions. Une classe se renomme au premier
  changement de style, et le guide pointerait alors le vide sans que rien ne le
  signale. Un attribut dédié se voit à la relecture et se déplace avec l'élément.
*/
export interface TourStep {
  /** Valeur de `data-tour` à mettre en avant. Absente = étape sautée. */
  target: string;
  title: string;
  body: string;
}

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;
const GAP = 12;

/** L'élément est-il réellement à l'écran ? */
function measure(target: string): Spot | null {
  const node = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!node) return null;

  /*
    Un élément masqué par une requête de média — la barre d'onglets porte
    `lg:hidden`, la colonne latérale l'inverse — occupe un rectangle vide. Le
    mettre en avant dessinerait un cadre de un pixel dans un coin. Les deux
    portent les mêmes repères : on garde celui qui est visible.
  */
  const rect = node.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return null;

  return {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

/**
 * Le guide d'utilisation, étape par étape.
 *
 * Il montre l'application sur l'application, ce qu'aucun texte d'aide ne
 * remplace : la personne voit l'onglet dont on lui parle, à sa place, avec son
 * icône. C'est ce qui compte pour une clientèle dont une partie n'a jamais
 * utilisé de place de marché.
 *
 * Trois principes ont guidé la forme :
 *
 *   · **Il ne se déclenche qu'une fois**, à la première visite, et se relance
 *     depuis les réglages. Un guide qui revient devient une porte à claquer.
 *   · **Il saute ce qui n'est pas là.** Sur ordinateur la barre d'onglets est
 *     masquée, la colonne latérale la remplace ; les deux portent les mêmes
 *     repères, et l'étape suit ce qui est visible. Une étape sans cible visible
 *     est retirée, jamais montrée dans le vide.
 *   · **Il n'avance jamais tout seul.** Aucun compte à rebours : la personne
 *     lit à son rythme, ce qui est la moindre des choses quand on explique.
 */
export function ProductTour({
  steps,
  storageKey,
}: {
  steps: TourStep[];
  /** Une clé par public : le vendeur voit son guide même s'il a vu celui du client. */
  storageKey: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [usable, setUsable] = useState<TourStep[]>([]);

  /*
    Ouvrir à la première visite seulement.

    Le délai laisse la mise en page se stabiliser : mesurer un onglet avant que
    les polices et les images n'aient fixé leur hauteur donne un cadre décalé de
    quelques dizaines de pixels, ce qui se voit immédiatement.
  */
  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;

    const timer = setTimeout(() => {
      const present = steps.filter((step) => measure(step.target) !== null);
      if (present.length === 0) return;

      setUsable(present);
      setOpen(true);
    }, 900);

    return () => clearTimeout(timer);
  }, [steps, storageKey]);

  /* Relance depuis les réglages, sans rechargement. */
  useEffect(() => {
    const onReplay = () => {
      const present = steps.filter((step) => measure(step.target) !== null);
      if (present.length === 0) return;

      setUsable(present);
      setIndex(0);
      setOpen(true);
    };

    window.addEventListener("meg:tour", onReplay);
    return () => window.removeEventListener("meg:tour", onReplay);
  }, [steps]);

  const step = usable[index];

  /* Suivre la cible : défilement, rotation, clavier qui s'ouvre. */
  const reposition = useCallback(() => {
    if (!step) return;
    setSpot(measure(step.target));
  }, [step]);

  useEffect(() => {
    if (!open || !step) return;

    const node = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });

    // Après le défilement, pas avant : les coordonnées auraient changé.
    const settle = setTimeout(reposition, 320);

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, step, reposition]);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey, "1");
    setOpen(false);
    setIndex(0);
  }, [storageKey]);

  /* Échap ferme : c'est le réflexe, et un guide dont on ne sort pas est un piège. */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open || !step || !spot) return null;

  const last = index === usable.length - 1;

  // Au-dessus quand la cible occupe le bas de l'écran — la barre d'onglets, le
  // plus souvent —, en dessous sinon.
  const below = spot.top + spot.height / 2 < window.innerHeight / 2;
  const top = below ? spot.top + spot.height + GAP : undefined;
  const bottom = below ? undefined : window.innerHeight - spot.top + GAP;

  return (
    <div role="dialog" aria-modal="true" aria-label={t.tour.title} className="fixed inset-0 z-[80]">
      {/* Le voile bloque les touchers : pendant le guide, seuls ses boutons agissent. */}
      <button
        type="button"
        aria-label={t.tour.skip}
        onClick={finish}
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
      />

      {/*
        La mise en évidence par une ombre démesurée.

        Une seule boîte, dont l'ombre porte à neuf mille pixels : elle assombrit
        tout l'écran sauf elle-même. Quatre panneaux ajustés autour de la cible
        auraient produit des liserés d'un pixel aux jonctions à chaque défilement.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[14px] transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 9999px rgba(24,16,36,0.62)",
          outline: "2px solid var(--color-brand)",
          outlineOffset: "1px",
        }}
      />

      <div
        className="absolute mx-auto w-[min(320px,calc(100vw-32px))] rounded-[18px] bg-[var(--color-surface)] p-4 shadow-[0_12px_40px_rgba(20,12,30,0.4)]"
        style={{
          top,
          bottom,
          insetInlineStart: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-brand)] uppercase">
          {t.tour.step.replace("{n}", String(index + 1)).replace("{total}", String(usable.length))}
        </p>

        <h2 className="mt-1 text-[14px] font-bold text-[var(--color-ink)]">{step.title}</h2>
        <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--color-muted)]">{step.body}</p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={finish}
            className="flex-1 rounded-[13px] border border-[var(--color-outline)] py-[9px] text-[11.5px] font-semibold text-[var(--color-muted)]"
          >
            {last ? t.common.close : t.tour.skip}
          </button>

          {!last && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="flex-1 rounded-[13px] bg-[var(--color-brand)] py-[9px] text-[11.5px] font-bold text-white"
            >
              {t.tour.next}
            </button>
          )}

          {last && (
            <button
              type="button"
              onClick={finish}
              className="flex-1 rounded-[13px] bg-[var(--color-brand)] py-[9px] text-[11.5px] font-bold text-white"
            >
              {t.tour.done}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bouton « revoir le guide », à poser dans les réglages. */
export function ReplayTourButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("meg:tour"))}
      className="w-full rounded-[18px] border border-[var(--color-outline)] py-3 text-[12px] font-semibold text-[var(--color-brand)]"
    >
      {label}
    </button>
  );
}
