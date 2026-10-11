"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./layouts/types";
import { fondSansPhoto } from "./feuille-produit";

const VITESSE = 22; // °/s, rotation lente au repos

/** Un téléphone (écran, RAM, sous-catégorie) prend la forme d'un appareil ; le reste, celle d'un plateau carré. */
function estUnTelephone(p: ProduitBoutique): boolean {
  return p.category?.slug === "electronique-telephones" || Boolean(p.attributs?.ecran || p.attributs?.ram);
}

/**
 * Le produit en grand, en volume, qu'on fait tourner du doigt — Téléphones.
 *
 * Un objet 3D en CSS (faces avant, arrière et tranches) : l'avant porte la
 * première photo du produit, l'arrière la deuxième s'il y en a une — sinon
 * un dos uni aux couleurs du produit avec son nom, jamais un appareil photo
 * dessiné qui ferait croire à un modèle précis. Les autres photos se
 * choisissent en vignettes et passent à l'avant.
 *
 * Glisser fait tourner (0,6° par pixel) avec de l'élan ; au repos, l'objet
 * tourne lentement (rien sous `prefers-reduced-motion`). « ⤢ » l'ouvre en
 * plein écran. Le défilement vertical de la feuille reste possible : seul
 * un geste horizontal est capturé.
 */
export function Visionneuse3D({ produit, locale }: { produit: ProduitBoutique; locale: AppLocale }) {
  const ar = locale === "ar";
  const [plein, setPlein] = useState(false);
  const [indexAvant, setIndexAvant] = useState(0);
  const corps = useRef<HTMLDivElement>(null);
  const ombre = useRef<HTMLDivElement>(null);
  const reflet = useRef<HTMLDivElement>(null);
  const etat = useRef({ a: -28, v: VITESSE, glisse: false, x0: 0, t0: 0, deplace: 0, repos: 0 });

  const telephone = estUnTelephone(produit);
  const images = produit.images;
  const avant = images[indexAvant] ?? null;
  const arriere = images.find((_, i) => i !== indexAvant) ?? null;

  // Dimensions de l'objet, agrandies en plein écran.
  const echelle = plein ? 1.45 : 1;
  const L = Math.round((telephone ? 150 : 200) * echelle);
  const H = Math.round((telephone ? 304 : 200) * echelle);
  const P = Math.round((telephone ? 14 : 16) * echelle);
  const rayon = Math.round((telephone ? 30 : 26) * echelle);
  /** Bande du bas réservée aux boutons, sous l'objet. */
  const BANDE = 52;
  const hauteurScene = plein ? Math.max(H + 140, 520) : H + 40 + BANDE;
  const centre = (hauteurScene - BANDE) / 2;

  useEffect(() => {
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dernier = performance.now();
    let raf = 0;
    const image = (t: number) => {
      const dt = Math.min(0.05, (t - dernier) / 1000);
      dernier = t;
      const s = etat.current;
      if (!s.glisse) {
        // Après un geste, l'élan s'éteint puis la rotation lente reprend.
        const cible = reduit || t < s.repos ? 0 : VITESSE;
        s.v += (cible - s.v) * Math.min(1, dt * 1.8);
        s.a += s.v * dt;
      }
      const rad = (s.a * Math.PI) / 180;
      if (corps.current) corps.current.style.transform = `rotateX(-8deg) rotateY(${s.a.toFixed(2)}deg)`;
      if (ombre.current) ombre.current.style.transform = `scaleX(${(0.55 + 0.45 * Math.abs(Math.cos(rad))).toFixed(3)})`;
      if (reflet.current) reflet.current.style.backgroundPosition = `${(50 + Math.sin(rad) * 60).toFixed(1)}% 0`;
      raf = requestAnimationFrame(image);
    };
    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!plein) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // La feuille écoute aussi Échap : ne fermer que le plein écran.
        e.stopImmediatePropagation();
        setPlein(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [plein]);

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = etat.current;
    s.glisse = true;
    s.x0 = e.clientX;
    s.t0 = performance.now();
    s.deplace = 0;
    s.v = 0;
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = etat.current;
    if (!s.glisse) return;
    const now = performance.now();
    const dx = e.clientX - s.x0;
    s.a += dx * 0.6;
    s.v = s.v * 0.5 + ((dx * 0.6) / (Math.max(1, now - s.t0) / 1000)) * 0.5;
    s.x0 = e.clientX;
    s.t0 = now;
    s.deplace += Math.abs(dx);
    if (s.deplace >= 6 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture refusée : le geste fonctionne quand même
      }
    }
  }
  function onUp() {
    const s = etat.current;
    if (!s.glisse) return;
    s.glisse = false;
    s.v = Math.max(-900, Math.min(900, s.v));
    s.repos = performance.now() + 2500;
  }
  function tourner(delta: number) {
    const s = etat.current;
    s.a += delta;
    s.v = 0;
    s.repos = performance.now() + 3000;
  }

  const face = "absolute left-1/2 top-1/2 overflow-hidden [backface-visibility:hidden]";
  const tranche = produit.colors?.[0]
    ? `linear-gradient(90deg,color-mix(in srgb,${produit.colors[0]} 55%,#000),${produit.colors[0]},color-mix(in srgb,${produit.colors[0]} 55%,#000))`
    : "linear-gradient(90deg,#2a2e36,#9aa1ad,#2a2e36)";

  const scene = (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        etat.current.glisse = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") tourner(-30);
        if (e.key === "ArrowRight") tourner(30);
      }}
      tabIndex={0}
      role="img"
      aria-label={`${produit.name} — ${ar ? "اسحب لتدوير المنتج" : "glissez pour faire tourner le produit"}`}
      className="relative w-full cursor-grab touch-pan-y overflow-hidden outline-none select-none active:cursor-grabbing"
      style={{
        height: hauteurScene,
        perspective: "1000px",
        background:
          "radial-gradient(60% 50% at 50% 45%,rgba(90,140,255,.28),transparent 70%),linear-gradient(180deg,#05070d,#0b1224)",
        borderRadius: plein ? 0 : 22,
      }}
    >
      {/* Ombre au sol, plus étroite quand l'objet est de profil */}
      <div
        ref={ombre}
        className="pointer-events-none absolute left-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(0,0,0,.55),transparent)]"
        style={{ width: L * 1.3, height: 26, marginLeft: (-L * 1.3) / 2, top: centre + H / 2 + 4 }}
      />
      <div className="absolute inset-x-0 top-0" style={{ bottom: BANDE, transformStyle: "preserve-3d" }}>
      <div ref={corps} className="absolute inset-0" style={{ transformStyle: "preserve-3d", willChange: "transform" }}>
        {/* Avant : l'écran (ou la face du produit) */}
        <div
          className={face}
          style={{
            width: L,
            height: H,
            marginLeft: -L / 2,
            marginTop: -H / 2,
            borderRadius: rayon,
            transform: `translateZ(${P / 2}px)`,
            background: telephone ? "#07080c" : "#fff",
            padding: telephone ? Math.round(5 * echelle) : 0,
            boxShadow: "0 0 0 1px rgba(150,190,255,.35)",
          }}
        >
          <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: telephone ? rayon - 5 : rayon }}>
            {avant ? (
              // eslint-disable-next-line @next/next/no-img-element -- face avant de l'objet 3D
              <img src={avant} alt="" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center p-3 text-center text-[1.25rem] font-black text-white"
                style={{ background: fondSansPhoto(produit) }}
              >
                {produit.name}
              </span>
            )}
            <div
              ref={reflet}
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,.28)_50%,transparent_65%)] bg-[length:250%_100%]"
            />
          </div>
        </div>

        {/* Arrière : la deuxième photo, sinon un dos uni au nom du produit */}
        <div
          className={face}
          style={{
            width: L,
            height: H,
            marginLeft: -L / 2,
            marginTop: -H / 2,
            borderRadius: rayon,
            transform: `rotateY(180deg) translateZ(${P / 2}px)`,
            background: arriere ? "#07080c" : fondSansPhoto(produit),
            boxShadow: "0 0 0 1px rgba(150,190,255,.35)",
          }}
        >
          {arriere ? (
            // eslint-disable-next-line @next/next/no-img-element -- face arrière de l'objet 3D
            <img src={arriere} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-white">
              {produit.attributs?.marque && (
                <span className="text-[0.75rem] font-bold tracking-[0.2em] uppercase opacity-80">{produit.attributs.marque}</span>
              )}
              <span className="text-[1rem] font-black">{produit.name}</span>
            </span>
          )}
        </div>

        {/* Tranches gauche / droite / haut / bas */}
        {[90, -90].map((r) => (
          <div
            key={r}
            className="absolute left-1/2 top-1/2"
            style={{
              width: P,
              height: H - rayon * 1.2,
              marginLeft: -P / 2,
              marginTop: -(H - rayon * 1.2) / 2,
              background: tranche,
              transform: `rotateY(${r}deg) translateZ(${L / 2 - 1}px)`,
            }}
          />
        ))}
        {[90, -90].map((r) => (
          <div
            key={r}
            className="absolute left-1/2 top-1/2"
            style={{
              width: L - rayon * 1.2,
              height: P,
              marginLeft: -(L - rayon * 1.2) / 2,
              marginTop: -P / 2,
              background: tranche,
              transform: `rotateX(${r}deg) translateZ(${H / 2 - 1}px)`,
            }}
          />
        ))}
      </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => tourner(180)}
          className="min-h-[36px] rounded-full bg-[rgba(255,255,255,.14)] px-3 text-[0.75rem] font-bold text-white backdrop-blur-sm"
        >
          ↻ {ar ? "اقلب" : "Retourner"}
        </button>
        <span className="text-[0.6875rem] font-semibold text-white/70">{ar ? "اسحب لتدوير المنتج" : "Glissez pour tourner"}</span>
        <button
          type="button"
          onClick={() => setPlein((p) => !p)}
          aria-label={plein ? (ar ? "تصغير" : "Réduire") : ar ? "ملء الشاشة" : "Plein écran"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,.14)] text-[1rem] font-bold text-white backdrop-blur-sm"
        >
          {plein ? "✕" : "⤢"}
        </button>
      </div>
    </div>
  );

  const vignettes =
    images.length > 1 ? (
      <div className="no-sb flex gap-2 overflow-x-auto pt-2">
        {images.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setIndexAvant(i)}
            aria-pressed={i === indexAvant}
            aria-label={`${ar ? "صورة" : "Photo"} ${i + 1}`}
            className="h-14 w-14 flex-none overflow-hidden rounded-[12px]"
            style={{ boxShadow: i === indexAvant ? "0 0 0 2px var(--theme-accent)" : "0 0 0 1px var(--theme-bordure)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- vignette 56px */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    ) : null;

  if (plein) {
    /*
      Rendu dans <body> : la feuille est transformée (translateY), ce qui
      piégerait un `position: fixed` dans ses propres limites.
    */
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label={produit.name} className="fixed inset-0 z-[60] flex flex-col justify-center bg-[#05070d]">
        {scene}
        {vignettes && <div className="px-4 pb-6">{vignettes}</div>}
      </div>,
      document.body,
    );
  }

  return (
    <div className="flex flex-col">
      {scene}
      {vignettes}
    </div>
  );
}
