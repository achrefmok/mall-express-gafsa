"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AppLocale } from "@/types/database";

export interface Affiche {
  id: string;
  titre: string;
  sousTitre: string | null;
  image: string | null;
  /** Où mène l'affiche ; `null` : rien à ouvrir (affiche municipale, festival…). */
  href: string | null;
}

const DUREE = 4200;
const PAUSE_APRES_TOUCHER = 6000;

/**
 * « À l'affiche » (handoff) : carrousel sponsorisé de 196 px, rayon 26,
 * défilement natif à aimantation. Barres de progression façon stories en
 * haut, zoom lent de la photo (1 → 1,08 sur 4,4 s), légende qui monte, et
 * avance automatique toutes les 4,2 s — suspendue 6 s après un toucher,
 * absente sous `prefers-reduced-motion`.
 */
export function ALAffiche({ affiches, locale }: { affiches: Affiche[]; locale: AppLocale }) {
  const ar = locale === "ar";
  const rail = useRef<HTMLDivElement>(null);
  const tenu = useRef(0);
  const [actif, setActif] = useState(0);
  const [tour, setTour] = useState(0);
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduit(r);
    if (r || affiches.length < 2) return;
    const id = setInterval(() => {
      const el = rail.current;
      if (!el || Date.now() - tenu.current < PAUSE_APRES_TOUCHER) return;
      const suivant = (Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth)) + 1) % affiches.length;
      el.scrollTo({ left: suivant * el.clientWidth * (ar ? -1 : 1), behavior: "smooth" });
    }, DUREE);
    return () => clearInterval(id);
  }, [affiches.length, ar]);

  function onScroll() {
    const el = rail.current;
    if (!el) return;
    const i = Math.min(affiches.length - 1, Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth)));
    if (i !== actif) {
      setActif(i);
      setTour((t) => t + 1);
    }
  }

  if (affiches.length === 0) return null;

  return (
    <section data-rv className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-2 px-[18px]">
        <i aria-hidden className="h-[9px] w-[9px] rounded-full bg-[oklch(.65_.14_60)]" />
        <h2 className="text-[1rem] font-extrabold tracking-[-0.2px]">{ar ? "على الملصق" : "À l’affiche"}</h2>
        <span className="ms-auto rounded-full border border-[rgba(60,40,90,.14)] px-[9px] py-[3px] text-[0.5625rem] font-extrabold tracking-[0.12em] text-[#767085]">
          {ar ? "مُموَّل" : "SPONSORISÉ"}
        </span>
      </div>
      <div
        onPointerDown={() => (tenu.current = Date.now())}
        className="relative mx-4 h-[196px] overflow-hidden rounded-[26px] bg-[#3E2A56] shadow-[0_16px_34px_rgba(60,40,90,.24)]"
      >
        <div ref={rail} onScroll={onScroll} className="no-sb flex h-full snap-x snap-mandatory overflow-x-auto">
          {affiches.map((a, i) => {
            const enCours = i === actif;
            const contenu = (
              <>
                {a.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- bannière plein cadre
                  <img
                    src={a.image}
                    alt={a.titre}
                    className="h-full w-full object-cover"
                    style={{ transform: `scale(${enCours && !reduit ? 1.08 : 1})`, transition: enCours ? "transform 4.4s linear" : "none" }}
                  />
                )}
                <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(20,14,26,.82),rgba(20,14,26,.1)_55%,rgba(20,14,26,.35))]" />
                <span
                  className="absolute inset-x-4 bottom-[14px] flex items-end justify-between gap-[10px] text-white"
                  style={{
                    opacity: enCours ? 1 : 0,
                    transform: enCours ? "none" : "translateY(10px)",
                    transition: "opacity .5s ease .15s, transform .5s cubic-bezier(.2,.8,.2,1) .15s",
                  }}
                >
                  <span className="flex min-w-0 flex-col gap-[2px] leading-[1.2]">
                    <b className="line-clamp-2 text-[1.1875rem] tracking-[-0.3px]">{a.titre}</b>
                    {a.sousTitre && <span className="truncate text-[0.75rem] opacity-85">{a.sousTitre}</span>}
                  </span>
                  {/*
                    Seul le bouton ouvre l'affiche. L'image entière était un
                    lien : en faisant glisser le carrousel au doigt, on
                    l'ouvrait sans le vouloir.
                  */}
                  {a.href && (
                    <Link
                      href={a.href}
                      className="press flex h-9 flex-none items-center rounded-[18px] bg-white px-[15px] text-[0.78125rem] font-extrabold text-[#241F2E]"
                    >
                      {ar ? "اكتشف" : "Découvrir"}
                    </Link>
                  )}
                </span>
              </>
            );
            return (
              <div key={a.id} className="relative h-full w-full flex-none snap-center overflow-hidden">
                {contenu}
              </div>
            );
          })}
        </div>
        {affiches.length > 1 && (
          <div aria-hidden className="pointer-events-none absolute inset-x-4 top-3 flex gap-[5px]">
            {affiches.map((a, i) => (
              <span key={a.id} className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-white/30">
                <i
                  key={i === actif ? `${a.id}-${tour}` : a.id}
                  className="block h-full origin-left rounded-[2px] bg-white rtl:origin-right"
                  style={{
                    transform: i < actif ? "scaleX(1)" : "scaleX(0)",
                    animation: i === actif && !reduit ? `gm-bar ${DUREE}ms linear forwards` : undefined,
                  }}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
