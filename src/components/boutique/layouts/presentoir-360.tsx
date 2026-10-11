"use client";

import { useEffect, useRef, useState } from "react";
import type { AppLocale } from "@/types/database";

export interface PieceDuPortant {
  id: string;
  nom: string;
  /** Mot court affiché en grand sur une pièce sans photo (« Robe », « Blazer »). */
  motCourt: string;
  prix: string;
  image: string | null;
  /** Couleurs réelles du produit (`products.colors`), pour le fond d'une pièce sans photo. */
  couleurs: string[];
  /** Faux si les filtres actifs (rayon, taille, recherche) l'écartent : la pièce s'éteint. */
  correspond: boolean;
}

/*
  Matériaux de la scène — l'or du portant, la nuit du showroom. Ce ne sont
  pas des couleurs d'identité de boutique (celles-ci restent les jetons
  `--theme-*`, violet app pour toutes) : c'est le rendu d'un objet, le
  « portant doré à cintres » du handoff Mode, repris tel quel.
*/
const SCENE = {
  fond:
    "radial-gradient(80% 60% at 50% 30%,#3a2a44,transparent 70%),linear-gradient(180deg,#1a1320 0%,#251b2d 78%,#0e0a12 78.3%,#18111d 100%)",
  mur: "rgba(232,205,150,.45)",
  lampe: "rgba(255,236,200,.7)",
  cone: "linear-gradient(180deg,rgba(255,230,180,.22),transparent 85%)",
  sol: "radial-gradient(closest-side,rgba(255,230,190,.25),transparent)",
  or: "conic-gradient(from 20deg,#fff3d0,#b08a3e,#f6e3b4,#7a5a22,#fbe9be,#a07c34,#fff3d0)",
  liseré: "0 0 0 1px rgba(232,205,150,.35),0 18px 30px rgba(0,0,0,.55)",
  dos: "linear-gradient(160deg,#2a1f33,#120d17)",
  marque: "#c9a14f",
  pastille: "linear-gradient(90deg,#e8cd96,#c9a14f)",
  encrePastille: "#1a1320",
};

const LARGEUR = 86;
const HAUTEUR = 124;
const VITESSE = -14; // °/s, rotation automatique

/** Fond d'une pièce sans photo : ses propres couleurs, sinon un gris neutre. */
function fondPiece(p: PieceDuPortant): string {
  const [a, b] = p.couleurs;
  if (a && b) return `linear-gradient(160deg,${a},${b})`;
  if (a) return `linear-gradient(160deg,${a},color-mix(in srgb,${a} 70%,#000))`;
  return "linear-gradient(160deg,#4a4458,#2c2736)";
}

/**
 * Le « portant doré à cintres » 360° du handoff Mode.
 *
 * Moteur repris du prototype : rotation automatique, glisser pour tourner
 * (0,5° par pixel), élan plafonné au relâcher qui revient doucement à la
 * vitesse de croisière, balancement des cintres selon la vitesse. Un tap
 * sans glisser (moins de 6 px) ouvre la pièce de face. Les styles animés
 * sont posés directement sur le DOM à chaque image, sans re-rendu React.
 */
export function Presentoir360({
  pieces,
  locale,
  onOuvrir,
}: {
  pieces: PieceDuPortant[];
  locale: AppLocale;
  onOuvrir: (id: string) => void;
}) {
  const [enPause, setEnPause] = useState(false);
  const rotor = useRef<HTMLDivElement>(null);
  const cartes = useRef<Array<HTMLDivElement | null>>([]);
  const etat = useRef({ a: 0, v: VITESSE, glisse: false, x0: 0, t0: 0, deplace: 0, face: 0 });
  const pauseRef = useRef(false);
  const piecesRef = useRef(pieces);
  const ouvrirRef = useRef(onOuvrir);

  pauseRef.current = enPause;
  piecesRef.current = pieces;
  ouvrirRef.current = onOuvrir;

  const n = pieces.length;
  const pas = 360 / n;
  const rayon = Math.max(124, Math.round((n * (LARGEUR + 18)) / (2 * Math.PI)));

  useEffect(() => {
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dernier = performance.now();
    let raf = 0;

    const image = (t: number) => {
      const dt = Math.min(0.05, (t - dernier) / 1000);
      dernier = t;
      const s = etat.current;
      const total = piecesRef.current.length;

      if (rotor.current && total > 0) {
        if (!s.glisse) {
          const cible = pauseRef.current || reduit ? 0 : VITESSE;
          s.v += (cible - s.v) * Math.min(1, dt * 1.6);
          s.a += s.v * dt;
        }
        rotor.current.style.transform = `rotateY(${s.a}deg)`;

        const etape = 360 / total;
        const balancement = Math.max(-14, Math.min(14, s.v * 0.045));
        let meilleur = 0;
        let ecart = 999;

        for (let i = 0; i < total; i++) {
          const angle = ((((s.a - i * etape) % 360) + 540) % 360) - 180;
          if (Math.abs(angle) < ecart) {
            ecart = Math.abs(angle);
            meilleur = i;
          }
          const z = Math.cos((angle * Math.PI) / 180);
          const k = (z + 1) / 2;
          const el = cartes.current[i];
          if (el) {
            // Le dos de la carte quand elle tourne le dos : jamais de texte en miroir.
            el.style.setProperty("--dos", z < -0.05 ? "1" : "0");
            el.style.filter = `brightness(${(0.45 + 0.55 * k).toFixed(3)}) saturate(${(0.6 + 0.4 * k).toFixed(2)})`;
            el.style.transform = `rotateZ(${(balancement * (1 + 0.3 * Math.sin(i))).toFixed(2)}deg) scale(${(0.92 + 0.1 * k * k).toFixed(3)})`;
          }
        }
        s.face = meilleur;
      }
      raf = requestAnimationFrame(image);
    };

    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = etat.current;
    s.glisse = true;
    s.x0 = e.clientX;
    s.t0 = performance.now();
    s.deplace = 0;
    s.v = 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // certains navigateurs refusent la capture : le glisser marche quand même
    }
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = etat.current;
    if (!s.glisse) return;
    const maintenant = performance.now();
    const dx = e.clientX - s.x0;
    const d = Math.max(1, maintenant - s.t0) / 1000;
    s.a += dx * 0.5;
    s.v = s.v * 0.5 + ((dx * 0.5) / d) * 0.5;
    s.x0 = e.clientX;
    s.t0 = maintenant;
    s.deplace += Math.abs(dx);
  }

  function onUp() {
    const s = etat.current;
    if (!s.glisse) return;
    s.glisse = false;
    s.v = Math.max(-720, Math.min(720, s.v));
    if (s.deplace < 6) {
      const piece = piecesRef.current[s.face];
      if (piece) ouvrirRef.current(piece.id);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-[14px]">
        <div className="flex min-w-0 flex-col leading-[1.25]">
          <span className="text-[1rem] font-extrabold">{locale === "ar" ? "الرّف الدوّار 360°" : "Portant 360°"}</span>
          <span className="text-[0.75rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "اسحب للتدوير · المس القطعة الأمامية" : "Glissez pour tourner · touchez la pièce de face"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEnPause((p) => !p)}
          className="min-h-[34px] flex-none rounded-[10px] border border-[var(--theme-bordure,var(--color-outline))] bg-[var(--theme-surface,var(--color-surface-solid))] px-3 text-[0.75rem] font-bold whitespace-nowrap text-[var(--theme-accent-fort,var(--color-brand))]"
        >
          {enPause ? (locale === "ar" ? "▶ تدوير" : "▶ Tourner") : locale === "ar" ? "Ⅱ إيقاف" : "Ⅱ Pause"}
        </button>
      </div>

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative mt-2 cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing"
        style={{ height: 390, perspective: "1100px", perspectiveOrigin: "50% 12%", background: SCENE.fond }}
      >
        <span
          dir="ltr"
          className="absolute top-[14px] right-4 font-mono text-[0.625rem] font-semibold tracking-[4px]"
          style={{ color: SCENE.mur }}
        >
          G-MALL · GAFSA
        </span>
        <span
          className="absolute top-0 left-1/2 -ml-[23px] h-2 w-[46px] rounded-b-[8px] bg-[#0f0c13]"
          style={{ boxShadow: `0 4px 18px ${SCENE.lampe}` }}
        />
        <div
          className="absolute top-[6px] left-1/2 -ml-[165px] w-[330px]"
          style={{ height: 340, background: SCENE.cone, clipPath: "polygon(43% 0,57% 0,100% 100%,0 100%)" }}
        />
        <div
          className="absolute left-1/2 -ml-[165px] h-20 w-[330px] rounded-[50%]"
          style={{ top: 292, background: SCENE.sol }}
        />

        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(-8deg)" }}>
          {/* Boule et mât du portant */}
          <span
            className="absolute top-[22px] left-1/2 -ml-2 h-4 w-4 rounded-full"
            style={{ background: "radial-gradient(circle at 35% 30%,#fff8e4,#c9a14f 55%,#6b4f1d)" }}
          />
          <div
            className="absolute top-[34px] left-1/2 -ml-1 w-2 rounded-[4px]"
            style={{ height: 290, background: "linear-gradient(90deg,#7a5a22,#fff3d0 40%,#b08a3e 65%,#5e441a)" }}
          />

          <div ref={rotor} className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
            {/* Anneau d'accroche et socle */}
            <div
              className="absolute left-1/2 rounded-full"
              style={{
                top: 50,
                width: 2 * rayon,
                height: 2 * rayon,
                marginLeft: -rayon,
                marginTop: -rayon,
                background: SCENE.or,
                WebkitMaskImage: "radial-gradient(closest-side,transparent calc(100% - 7px),#000 calc(100% - 6px))",
                maskImage: "radial-gradient(closest-side,transparent calc(100% - 7px),#000 calc(100% - 6px))",
                transform: "rotateX(90deg)",
              }}
            />
            <div
              className="absolute left-1/2 -mt-[75px] -ml-[75px] h-[150px] w-[150px] rounded-full"
              style={{
                top: 324,
                background: `radial-gradient(circle,#2a2431 0 22%,transparent 23%),${SCENE.or}`,
                transform: "rotateX(90deg)",
              }}
            />

            {pieces.map((p, i) => (
              <div
                key={p.id}
                className="absolute left-1/2"
                style={{
                  top: 40,
                  width: LARGEUR,
                  marginLeft: -LARGEUR / 2,
                  transform: `rotateY(${-i * pas}deg) translateZ(${rayon}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  ref={(el) => {
                    cartes.current[i] = el;
                  }}
                  className="flex flex-col items-center"
                  style={{ transformOrigin: "50% 0", willChange: "transform,filter" }}
                >
                  {/* Fil, cintre, attaches */}
                  <span className="h-4 w-px" style={{ background: "linear-gradient(180deg,#f6e3b4,#b08a3e)" }} />
                  <span
                    className="relative h-[3px] w-[62px] rounded-[2px]"
                    style={{ background: "linear-gradient(90deg,#8a6a2a,#fff3d0 50%,#8a6a2a)" }}
                  >
                    <i className="absolute -top-[5px] left-1/2 -ml-[3px] h-[6px] w-[6px] rounded-full border-[1.5px] border-[#e8cd96]" />
                  </span>
                  <span className="flex h-2 w-[62px] justify-between">
                    <i className="h-2 w-px" style={{ background: SCENE.marque }} />
                    <i className="h-2 w-px" style={{ background: SCENE.marque }} />
                  </span>

                  <div
                    className="relative overflow-hidden rounded-[12px] transition-opacity duration-300"
                    style={{
                      width: LARGEUR,
                      height: HAUTEUR,
                      background: p.image ? "#2c2736" : fondPiece(p),
                      boxShadow: SCENE.liseré,
                      opacity: p.correspond ? 1 : 0.25,
                    }}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- carte fixe 86×124
                      <img src={p.image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <span
                        dir="ltr"
                        className="absolute inset-x-2 top-[12%] text-center text-[1.0625rem] leading-none font-black tracking-[-0.3px] text-white"
                      >
                        {p.motCourt}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,.28)_0%,rgba(255,255,255,.05)_28%,transparent_42%)]" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[3px] bg-[linear-gradient(180deg,transparent,rgba(12,8,16,.86))] px-2 pt-[22px] pb-2 text-center text-white">
                      <span className="line-clamp-2 text-[0.625rem] leading-[1.2] font-bold">{p.nom}</span>
                      <span
                        className="rounded-full px-[7px] py-px text-[0.625rem] font-black whitespace-nowrap"
                        style={{ background: SCENE.pastille, color: SCENE.encrePastille }}
                      >
                        {p.prix}
                      </span>
                    </div>
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ opacity: "var(--dos,0)", background: SCENE.dos }}
                    >
                      <span
                        className="h-6 w-6 rotate-45"
                        style={{
                          border: `1.5px solid ${SCENE.marque}`,
                          boxShadow: `inset 0 0 0 5px rgba(0,0,0,.35),inset 0 0 0 6.5px ${SCENE.marque}`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
