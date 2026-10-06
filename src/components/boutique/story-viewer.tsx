"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon } from "@/components/ui/icons";
import type { StoryBoutique } from "@/lib/boutique-themes/attributs-server";

const DUREE_MS = 5000;

/** `'produit:<id>' | 'pack:<id>' | 'onglet:promos' | url` → un chemin réel. */
function resoudreCible(cible: string | null, shopSlug: string): string | null {
  if (!cible) return null;
  if (cible.startsWith("produit:")) return `/produit/${cible.slice("produit:".length)}`;
  if (cible.startsWith("onglet:")) return `/boutique/${shopSlug}?onglet=${cible.slice("onglet:".length)}`;
  // Pas de fiche publique dédiée à un pack aujourd'hui : on ramène à la
  // boutique plutôt que de fabriquer un lien qui mènerait nulle part.
  if (cible.startsWith("pack:")) return `/boutique/${shopSlug}`;
  return cible;
}

/**
 * Visionneuse plein écran — une story à la fois, avance automatique après
 * 5 s sauf préférence de mouvement réduit (tap uniquement dans ce cas).
 */
export function StoryViewer({
  stories,
  shopSlug,
  shopMonogram,
  shopName,
  indexDepart,
  onClose,
}: {
  stories: StoryBoutique[];
  shopSlug: string;
  shopMonogram: string;
  shopName: string;
  indexDepart: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(indexDepart);
  const [progres, setProgres] = useState(0);
  const depart = useRef(Date.now());
  const reduitRef = useRef(false);

  useEffect(() => {
    reduitRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    depart.current = Date.now();
    setProgres(0);
    if (reduitRef.current) return;

    const minuterie = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - depart.current) / DUREE_MS);
      setProgres(ratio);
      if (ratio >= 1) {
        clearInterval(minuterie);
        if (index < stories.length - 1) setIndex(index + 1);
        else onClose();
      }
    }, 100);

    return () => clearInterval(minuterie);
  }, [index, stories.length, onClose]);

  const story = stories[index];
  if (!story) return null;

  const cible = resoudreCible(story.cta_target, shopSlug);

  function suivant() {
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  }
  function precedent() {
    setIndex(Math.max(0, index - 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1b1724] text-white">
      {story.image_url && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-55"
            style={{ backgroundImage: `url(${story.image_url})` }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(27,23,36,0.6)_0%,rgba(27,23,36,0.1)_35%,rgba(27,23,36,0.85)_100%)]" />
        </>
      )}

      <div className="relative flex flex-none gap-1 p-3">
        {stories.map((s, i) => (
          <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              className="block h-full bg-white"
              style={{ width: i < index ? "100%" : i === index ? `${progres * 100}%` : "0%" }}
            />
          </span>
        ))}
      </div>

      <div className="relative flex flex-none items-center gap-[10px] px-[14px] py-3">
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.6875rem] font-extrabold">
          {shopMonogram}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.75rem] font-bold">{shopName}</span>
          <span className="truncate text-[0.625rem] opacity-75">{story.label}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 flex-none items-center justify-center"
          aria-label="Fermer"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="relative flex flex-1">
        <button type="button" onClick={precedent} className="flex-1" aria-label="Précédent" />
        <button type="button" onClick={suivant} className="flex-[2]" aria-label="Suivant" />
      </div>

      <div className="relative flex flex-col gap-[10px] px-5 pb-7">
        <span className="self-start rounded-[12px] bg-white/18 px-[11px] py-1 text-[0.625rem] font-bold">
          {story.label}
        </span>
        <span className="text-[1.75rem] leading-[1.1] font-extrabold text-wrap-balance">{story.title}</span>
        {story.subtitle && <span className="text-[0.8125rem] leading-[1.5] opacity-85">{story.subtitle}</span>}
        {cible && story.cta_label && (
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(cible);
            }}
            className="mt-[6px] rounded-[16px] bg-white px-[13px] py-[13px] text-center text-[0.8125rem] font-bold text-[var(--color-ink)]"
          >
            {story.cta_label} ↑
          </button>
        )}
      </div>
    </div>
  );
}
