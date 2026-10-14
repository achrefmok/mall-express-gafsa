"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * La zone qui défile de l'accueil (handoff « design_handoff_accueil »).
 *
 * · L'en-tête violet défile avec le contenu ; passé 170 px, une barre
 *   compacte descend du haut avec la recherche et une fine jauge de
 *   progression de lecture — seule la recherche reste toujours à portée.
 * · Chaque `[data-rv]` apparaît au défilement (fondu + 12 px), ses
 *   `[data-rvi]` en cascade de 50 ms ; chaque `[data-count]` compte de 0 à
 *   sa valeur en 1,1 s (ease-out cubique) à sa première apparition.
 * · `prefers-reduced-motion` : tout est affiché d'emblée, rien ne bouge.
 */
export function DefilementAccueil({
  compacte,
  children,
}: {
  compacte: ReactNode;
  children: ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const jauge = useRef<HTMLElement>(null);
  const [replie, setReplie] = useState(false);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const reduit = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const sections = [...el.querySelectorAll<HTMLElement>("[data-rv]")];
    const montrer = (s: HTMLElement) => {
      s.style.opacity = "1";
      s.style.transform = "none";
      s.querySelectorAll<HTMLElement>("[data-rvi]").forEach((it) => {
        it.style.opacity = "1";
        it.style.transform = "none";
      });
      if (reduit) return;
      s.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => {
        const cible = Number(c.dataset.count);
        if (!Number.isFinite(cible) || cible <= 0) return;
        const t0 = performance.now();
        const tic = (t: number) => {
          const k = Math.min(1, (t - t0) / 1100);
          c.textContent = Math.round(
            cible * (1 - Math.pow(1 - k, 3)),
          ).toLocaleString("fr-FR");
          if (k < 1) requestAnimationFrame(tic);
        };
        requestAnimationFrame(tic);
      });
    };

    if (reduit || !("IntersectionObserver" in window)) {
      sections.forEach(montrer);
      return;
    }
    sections.forEach((s) => {
      s.style.opacity = "0";
      s.style.transform = "translateY(12px)";
      s.style.transition =
        "opacity .45s ease, transform .45s cubic-bezier(.2,.8,.2,1)";
      [...s.querySelectorAll<HTMLElement>("[data-rvi]")].forEach((it, i) => {
        it.style.opacity = "0";
        it.style.transform = "translateY(12px)";
        it.style.transition = `opacity .45s ease ${i * 50}ms, transform .45s cubic-bezier(.2,.8,.2,1) ${i * 50}ms`;
      });
    });
    const io = new IntersectionObserver(
      (entrees) =>
        entrees.forEach((e) => {
          if (!e.isIntersecting) return;
          montrer(e.target as HTMLElement);
          io.unobserve(e.target);
        }),
      { threshold: 0.12 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  /*
    C'est la fenêtre qui défile dans cette application (gabarit en hauteur
    minimale de l'écran), pas une zone intérieure : on l'écoute elle.
  */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setReplie(y > 170);
      if (jauge.current) {
        const k = Math.min(
          1,
          y /
            Math.max(
              1,
              document.documentElement.scrollHeight - window.innerHeight,
            ),
        );
        jauge.current.style.transform = `scaleX(${k.toFixed(3)})`;
      }
    };
    setMonte(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={zone} className="flex min-h-0 flex-1 flex-col pb-6">
        {children}
      </div>

      {/*
        La barre compacte : la recherche, et la jauge de lecture. Rendue dans
        <body> : la transition de page ancêtre (transform) piégerait un
        `position: fixed` dans ses propres limites. `.clair-boutique` y
        reporte les jetons clairs de l'accueil.
      */}
      {monte &&
        createPortal(
          <div
            aria-hidden={!replie}
            className="clair-boutique fixed inset-x-0 top-0 z-40 mx-auto max-w-[520px] rounded-b-[24px] bg-[linear-gradient(140deg,#7E58A6_0%,#6D4B8F_55%,#3E2A56_100%)] px-[2px] pt-[10px] pb-[14px] shadow-[0_10px_24px_rgba(60,40,90,.25)] transition-transform duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{
              transform: replie ? "translateY(0)" : "translateY(-110%)",
              visibility: replie ? "visible" : "hidden",
            }}
          >
            {compacte}
            <span className="absolute inset-x-7 bottom-[5px] h-[3px] overflow-hidden rounded-[2px] bg-white/20">
              <i
                ref={jauge}
                className="block h-full origin-left rounded-[2px] bg-[linear-gradient(90deg,#F29BB0,#ffffff)] rtl:origin-right"
                style={{ transform: "scaleX(0)" }}
              />
            </span>
          </div>,
          document.body,
        )}
    </div>
  );
}
