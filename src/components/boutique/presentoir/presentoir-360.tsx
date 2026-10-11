"use client";

import { useEffect, useRef, useState } from "react";
import { reglagesScene, type SceneVitrine } from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";

export interface PieceDuPresentoir {
  id: string;
  nom: string;
  /** Mot court affiché en grand sur une pièce sans photo (« Robe », « S24 »). */
  motCourt: string;
  prix: string;
  image: string | null;
  /** Couleurs réelles du produit (`products.colors`), pour le fond d'une pièce sans photo. */
  couleurs: string[];
  /** Faux si le filtre actif l'écarte : la pièce s'éteint (opacité .25). */
  correspond: boolean;
}

/** Fond d'une pièce sans photo : ses propres couleurs, sinon le neutre de la scène. */
function fondPiece(p: PieceDuPresentoir, neutre: string): string {
  const [a, b] = p.couleurs;
  if (a && b) return `linear-gradient(160deg,${a},${b})`;
  if (a) return `linear-gradient(160deg,${a},color-mix(in srgb,${a} 70%,#000))`;
  return neutre;
}

/**
 * Le présentoir 360° du handoff, commun à tous les métiers — seule la
 * scène change (portant doré, socle de verre, plateau de marbre…, voir
 * `SceneVitrine` dans `src/lib/boutique-vitrines/configs.ts`).
 *
 * Moteur repris du prototype : rotation automatique −14°/s, glisser pour
 * tourner (0,5° par pixel), élan plafonné à ±720°/s qui revient en douceur,
 * balancement des cintres en mode suspendu. Un tap sans glisser (moins de
 * 6 px) ouvre la pièce de face.
 *
 * Fluidité sur téléphone : les styles animés sont écrits directement sur le
 * DOM, sans re-rendu React, et seulement quand ils changent ; l'assombris-
 * sement des pièces de dos passe par l'opacité d'un voile (composité par le
 * GPU) plutôt que par un `filter` recalculé à chaque image ; la boucle
 * s'arrête dès que le présentoir sort de l'écran ou que l'onglet est caché.
 */
export function Presentoir360({
  pieces,
  scene,
  texteMur,
  locale,
  onOuvrir,
  onFace,
}: {
  pieces: PieceDuPresentoir[];
  scene: SceneVitrine;
  texteMur: string;
  locale: AppLocale;
  onOuvrir: (id: string) => void;
  /** Appelé quand la pièce de face change — alimente la plaque « في الواجهة الآن ». */
  onFace?: (id: string) => void;
}) {
  const [enPause, setEnPause] = useState(false);
  const scenePlateau = useRef<HTMLDivElement>(null);
  const rotor = useRef<HTMLDivElement>(null);
  const cartes = useRef<Array<HTMLDivElement | null>>([]);
  const voiles = useRef<Array<HTMLDivElement | null>>([]);
  const dernierStyle = useRef<Array<{ t: string; v: string; d: string }>>([]);
  const r = reglagesScene(scene);
  const vitesse = r.vitesse;
  const etat = useRef({ a: 0, v: vitesse, glisse: false, x0: 0, t0: 0, deplace: 0, face: -1, repos: 0 });
  const vitesseRef = useRef(vitesse);
  vitesseRef.current = vitesse;
  const brumeMax = r.brume.max;
  const pauseRef = useRef(false);
  const piecesRef = useRef(pieces);
  const ouvrirRef = useRef(onOuvrir);
  const faceRef = useRef(onFace);

  pauseRef.current = enPause;
  piecesRef.current = pieces;
  ouvrirRef.current = onOuvrir;
  faceRef.current = onFace;

  const suspendu = scene.suspendu;
  const { largeur: L, hauteur: H } = scene.carte;
  const n = pieces.length;
  const pas = 360 / n;
  const rayon = Math.max(suspendu ? 124 : 112, Math.round((n * (L + 18)) / (2 * Math.PI)));
  const hauteurScene = suspendu ? 390 : 340;

  useEffect(() => {
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dernier = performance.now();
    let raf = 0;
    let visible = true;

    const image = (t: number) => {
      const dt = Math.min(0.05, (t - dernier) / 1000);
      dernier = t;
      const s = etat.current;
      const total = piecesRef.current.length;

      if (rotor.current && total > 0) {
        if (!s.glisse) {
          // Après un geste, l'élan s'éteint puis la rotation lente reprend.
          const cible = pauseRef.current || reduit || t < s.repos ? 0 : vitesseRef.current;
          s.v += (cible - s.v) * Math.min(1, dt * 1.6);
          s.a += s.v * dt;
        }
        rotor.current.style.transform = `rotateY(${s.a.toFixed(2)}deg)`;

        const etape = 360 / total;
        const balancement = suspendu ? Math.max(-14, Math.min(14, s.v * 0.045)) : 0;
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
          const voile = voiles.current[i];
          const memo = (dernierStyle.current[i] ??= { t: "", v: "", d: "" });

          const transform = suspendu
            ? `rotateZ(${(balancement * (1 + 0.3 * Math.sin(i))).toFixed(1)}deg) scale(${(0.92 + 0.1 * k * k).toFixed(3)})`
            : `scale(${(0.92 + 0.1 * k * k).toFixed(3)})`;
          // Luminosité .45 + .55k du prototype : un voile (noir, ou blanc pour
          // le showroom Mode) d'opacité max·(1−k).
          const assombri = (brumeMax * (1 - k)).toFixed(2);
          // Le dos de la carte quand elle tourne le dos : jamais de texte en miroir.
          const dos = z < -0.05 ? "1" : "0";

          if (el && memo.t !== transform) {
            el.style.transform = transform;
            memo.t = transform;
          }
          if (voile && memo.v !== assombri) {
            voile.style.opacity = assombri;
            memo.v = assombri;
          }
          if (el && memo.d !== dos) {
            el.style.setProperty("--dos", dos);
            memo.d = dos;
          }
        }
        if (meilleur !== s.face) {
          s.face = meilleur;
          const piece = piecesRef.current[meilleur];
          if (piece) faceRef.current?.(piece.id);
        }
      }
      raf = visible && !document.hidden ? requestAnimationFrame(image) : 0;
    };

    const relancer = () => {
      if (raf || !visible || document.hidden) return;
      dernier = performance.now();
      raf = requestAnimationFrame(image);
    };

    const observateur = new IntersectionObserver(([entree]) => {
      visible = entree.isIntersecting;
      relancer();
    });
    if (scenePlateau.current) observateur.observe(scenePlateau.current);
    document.addEventListener("visibilitychange", relancer);

    raf = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(raf);
      observateur.disconnect();
      document.removeEventListener("visibilitychange", relancer);
    };
  }, [suspendu, brumeMax]);

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
    const maintenant = performance.now();
    const dx = e.clientX - s.x0;
    const d = Math.max(1, maintenant - s.t0) / 1000;
    s.a += dx * 0.5;
    s.v = s.v * 0.5 + ((dx * 0.5) / d) * 0.5;
    s.x0 = e.clientX;
    s.t0 = maintenant;
    s.deplace += Math.abs(dx);
    // La capture n'est prise qu'au premier vrai glissement horizontal : un
    // doigt qui fait défiler la page verticalement n'est jamais retenu.
    if (s.deplace >= 6 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // certains navigateurs refusent la capture : le glisser marche quand même
      }
    }
  }

  function onUp() {
    const s = etat.current;
    if (!s.glisse) return;
    s.glisse = false;
    s.v = Math.max(-720, Math.min(720, s.v));
    s.repos = performance.now() + 1800;
  }

  /*
    La pièce s'ouvre au « click », pas au lever du doigt : sur écran
    tactile (Android), le navigateur envoie un click juste après
    pointerup, au même endroit. Ouvrir la fiche dès pointerup la faisait
    apparaître sous ce click, qui tombait sur son voile et la refermait
    aussitôt. Un glissement (6 px et plus) n'ouvre jamais rien.
  */
  function onClick() {
    if (etat.current.deplace < 6) ouvrirFace();
  }

  function ouvrirFace() {
    const s = etat.current;
    const piece = piecesRef.current[Math.max(0, s.face)];
    if (piece) ouvrirRef.current(piece.id);
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const s = etat.current;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      s.a += (e.key === "ArrowLeft" ? -1 : 1) * pas;
      s.v = 0;
      s.repos = performance.now() + 4000;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      ouvrirFace();
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-[14px]">
        <div className="flex min-w-0 flex-col leading-[1.25]">
          <span className="text-[1rem] font-extrabold">{locale === "ar" ? scene.titre.ar : scene.titre.fr}</span>
          <span className="text-[0.75rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "اسحب للتدوير · المس القطعة الأمامية" : "Glissez pour tourner · touchez la pièce de face"}
          </span>
        </div>
        {r.controles && (
        <button
          type="button"
          onClick={() => setEnPause((p) => !p)}
          className="min-h-[34px] flex-none rounded-[10px] border border-[var(--theme-bordure,var(--color-outline))] bg-[var(--theme-surface,var(--color-surface-solid))] px-3 text-[0.75rem] font-bold whitespace-nowrap text-[var(--theme-accent-fort,var(--color-brand))]"
        >
          {enPause ? (locale === "ar" ? "▶ تدوير" : "▶ Tourner") : locale === "ar" ? "Ⅱ إيقاف" : "Ⅱ Pause"}
        </button>
        )}
      </div>

      <div
        ref={scenePlateau}
        role="button"
        tabIndex={0}
        aria-label={`${locale === "ar" ? scene.titre.ar : scene.titre.fr} — ${
          locale === "ar" ? "الأسهم للتدوير، Enter لفتح القطعة الأمامية" : "flèches pour tourner, Entrée pour ouvrir la pièce de face"
        }`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          etat.current.glisse = false;
          // Geste repris par le défilement de la page : pas un tap.
          etat.current.deplace = 99;
        }}
        onClick={onClick}
        onKeyDown={onKey}
        className="relative mt-2 cursor-grab touch-pan-y overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] active:cursor-grabbing"
        style={{
          height: hauteurScene,
          perspective: "1100px",
          perspectiveOrigin: "50% 12%",
          background: scene.fond,
          contain: "layout paint",
        }}
      >
        <span
          dir="ltr"
          className="absolute top-[14px] right-4 max-w-[60%] truncate font-mono text-[0.625rem] font-semibold tracking-[4px]"
          style={{ color: scene.mur }}
        >
          {texteMur}
        </span>
        {r.luminaire && (
          <span
            className="absolute top-0 left-1/2 -ml-[23px] h-2 w-[46px] rounded-b-[8px]"
            style={{ background: r.luminaire, boxShadow: `0 4px 18px ${scene.lampe}` }}
          />
        )}
        <div
          className="absolute top-[6px] left-1/2 -ml-[165px] w-[330px]"
          style={{ height: suspendu ? 340 : 300, background: scene.cone, clipPath: "polygon(43% 0,57% 0,100% 100%,0 100%)" }}
        />
        <div
          className="absolute left-1/2 -ml-[165px] h-20 w-[330px] rounded-[50%]"
          style={{
            top: suspendu ? 292 : 248,
            background: r.sol,
          }}
        />

        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", transform: `rotateX(${suspendu ? -8 : -14}deg)` }}
        >
          {suspendu && (
            <>
              {/* Boule et mât du portant */}
              <span
                className="absolute top-[22px] left-1/2 -ml-2 h-4 w-4 rounded-full"
                style={{ background: r.metal.boule }}
              />
              <div
                className="absolute top-[34px] left-1/2 -ml-1 w-2 rounded-[4px]"
                style={{ height: 290, background: r.metal.mat }}
              />
            </>
          )}

          <div ref={rotor} className="absolute inset-0" style={{ transformStyle: "preserve-3d", willChange: "transform" }}>
            {suspendu ? (
              <>
                {/* Anneau d'accroche doré et socle */}
                <div
                  className="absolute left-1/2 rounded-full"
                  style={{
                    top: 50,
                    width: 2 * rayon,
                    height: 2 * rayon,
                    marginLeft: -rayon,
                    marginTop: -rayon,
                    background: r.metal.anneau,
                    WebkitMaskImage: "radial-gradient(closest-side,transparent calc(100% - 7px),#000 calc(100% - 6px))",
                    maskImage: "radial-gradient(closest-side,transparent calc(100% - 7px),#000 calc(100% - 6px))",
                    transform: "rotateX(90deg)",
                  }}
                />
                <div
                  className="absolute left-1/2 -mt-[75px] -ml-[75px] h-[150px] w-[150px] rounded-full"
                  style={{
                    top: 324,
                    background: `radial-gradient(circle,${r.metal.socleCentre} 0 22%,transparent 23%),${r.metal.anneau}`,
                    transform: "rotateX(90deg)",
                  }}
                />
              </>
            ) : (
              <>
                {/* Tranche puis dessus du plateau tournant */}
                <div
                  className="absolute left-1/2 rounded-full"
                  style={{
                    top: 290,
                    width: 2 * rayon + 60,
                    height: 2 * rayon + 60,
                    marginLeft: -(rayon + 30),
                    marginTop: -(rayon + 30),
                    background: scene.bord,
                    transform: "rotateX(90deg)",
                  }}
                />
                <div
                  className="absolute left-1/2 rounded-full"
                  style={{
                    top: 282,
                    width: 2 * rayon + 60,
                    height: 2 * rayon + 60,
                    marginLeft: -(rayon + 30),
                    marginTop: -(rayon + 30),
                    background: scene.disque,
                    boxShadow: scene.ombreDisque,
                    transform: "rotateX(90deg)",
                  }}
                />
              </>
            )}

            {pieces.map((p, i) => (
              <div
                key={p.id}
                aria-hidden
                className="absolute left-1/2"
                style={{
                  top: suspendu ? 40 : 280 - H,
                  width: L,
                  marginLeft: -L / 2,
                  transform: `rotateY(${-i * pas}deg) translateZ(${rayon}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  ref={(el) => {
                    cartes.current[i] = el;
                  }}
                  className="flex flex-col items-center"
                  style={{ transformOrigin: suspendu ? "50% 0" : "50% 100%", willChange: "transform" }}
                >
                  {suspendu && (
                    <>
                      {/* Fil, cintre, attaches */}
                      <span className="h-4 w-px" style={{ background: r.metal.fil }} />
                      <span
                        className="relative h-[3px] w-[62px] rounded-[2px]"
                        style={{ background: r.metal.cintre }}
                      >
                        <i
                          className="absolute -top-[5px] left-1/2 -ml-[3px] h-[6px] w-[6px] rounded-full border-[1.5px]"
                          style={{ borderColor: r.metal.attache }}
                        />
                      </span>
                      <span className="flex h-2 w-[62px] justify-between">
                        <i className="h-2 w-px" style={{ background: scene.marque }} />
                        <i className="h-2 w-px" style={{ background: scene.marque }} />
                      </span>
                    </>
                  )}

                  <div
                    className="relative overflow-hidden transition-opacity duration-300"
                    style={{
                      width: L,
                      height: H,
                      borderRadius: scene.carte.rayon,
                      background: p.image ? r.fondCarte : fondPiece(p, r.fondSansPhoto),
                      boxShadow: scene.carte.liseré,
                      opacity: p.correspond ? 1 : 0.25,
                    }}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- carte fixe, quelques dizaines de pixels
                      <img
                        src={p.image}
                        alt=""
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        dir="ltr"
                        className="absolute inset-x-2 top-[12%] line-clamp-2 text-center text-[1.0625rem] leading-none font-black tracking-[-0.3px] break-words text-white"
                      >
                        {p.motCourt}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,.28)_0%,rgba(255,255,255,.05)_28%,transparent_42%)]" />
                    <div
                      className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[3px] px-2 pt-[22px] pb-2 text-center"
                      style={{ background: r.etiquette.fond, color: r.etiquette.texte }}
                    >
                      <span className="line-clamp-2 text-[0.625rem] leading-[1.2] font-bold">{p.nom}</span>
                      <span
                        className="rounded-full px-[7px] py-px text-[0.625rem] font-black whitespace-nowrap"
                        style={{ background: scene.pastille, color: scene.encrePastille }}
                      >
                        {p.prix}
                      </span>
                    </div>
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ opacity: "var(--dos,0)", background: scene.dos }}
                    >
                      <span
                        className="h-6 w-6 rotate-45"
                        style={{
                          border: `1.5px solid ${scene.marque}`,
                          boxShadow: `inset 0 0 0 5px rgba(0,0,0,.35),inset 0 0 0 6.5px ${scene.marque}`,
                        }}
                      />
                    </div>
                    {/* Assombrissement selon la profondeur, dos compris — seule l'opacité change */}
                    <div
                      ref={(el) => {
                        voiles.current[i] = el;
                      }}
                      className="pointer-events-none absolute inset-0"
                      style={{ opacity: 0, background: r.brume.couleur }}
                    />
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
