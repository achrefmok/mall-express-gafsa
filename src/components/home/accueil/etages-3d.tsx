"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { monogram } from "@/lib/format";
import type { AppLocale } from "@/types/database";

export interface BoutiqueEtage {
  slug: string;
  nom: string;
  logo: string | null;
  hue: number;
  ouvert: boolean;
  live: boolean;
}

export interface Etage {
  /** 0 = rez-de-chaussée. */
  niveau: number;
  /** Les familles réellement présentes à cet étage (« Mode · Sport »), vide sinon. */
  nomFr: string;
  nomAr: string;
  boutiques: BoutiqueEtage[];
}

const VIOLET = "#6D4B8F";
const EASE = "cubic-bezier(.22,.61,.36,1)";

/**
 * « Les étages » — le plan 3D du mall (handoff, section dédiée).
 *
 * Cinq dalles isométriques empilées (RDC en bas) : chaque case est une vraie
 * boutique de l'étage (`shops.mall_level`), colorée par son vrai statut —
 * ouverte, en direct, fermée ; les cases restantes sont des emplacements
 * libres. Un premier toucher choisit l'étage (il monte, ceux du dessous
 * s'écartent), un second l'ouvre à plat : la grille de ses boutiques, dont
 * chacune s'agrandit jusqu'à couvrir la scène avant d'ouvrir sa page.
 * « ◱ Vue 3D » revient à la pile. Ascenseur automatique toutes les 3,2 s
 * tant que personne n'a touché la scène.
 *
 * ⚠ Jamais d'`opacity < 1` ni de `filter` sur une dalle preserve-3d visible :
 * Chrome aplatit alors la 3D (consigne du handoff).
 */
export function Etages3D({ etages, locale }: { etages: Etage[]; locale: AppLocale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const scene = useRef<HTMLDivElement>(null);
  const [choisi, setChoisi] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [touche, setTouche] = useState(false);

  useEffect(() => {
    if (touche || ouvert || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setChoisi((c) => (c + 1) % etages.length), 3200);
    return () => clearInterval(id);
  }, [touche, ouvert, etages.length]);

  const code = (n: number) => (n === 0 ? (ar ? "أرضي" : "RDC") : ar ? `ط${n}` : `N${n}`);
  const nomCourt = (e: Etage) => (ar ? e.nomAr : e.nomFr) || (ar ? "قريبا" : "Bientôt");

  function choisir(i: number) {
    setTouche(true);
    if (i === choisi && !ouvert) setOuvert(true);
    else {
      setChoisi(i);
      setOuvert(false);
    }
  }

  function entrer(e: React.MouseEvent<HTMLAnchorElement>, b: BoutiqueEtage) {
    const cadre = scene.current;
    if (!cadre || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    const rc = cadre.getBoundingClientRect();
    const rt = e.currentTarget.getBoundingClientRect();
    const volet = document.createElement("div");
    volet.style.cssText = `position:absolute;z-index:40;border-radius:16px;background:oklch(.5 .13 ${b.hue});left:${rt.left - rc.left}px;top:${rt.top - rc.top}px;width:${rt.width}px;height:${rt.height}px`;
    cadre.appendChild(volet);
    volet
      .animate(
        [
          {},
          { left: "0px", top: "0px", width: `${rc.width}px`, height: `${rc.height}px`, borderRadius: "26px" },
        ],
        { duration: 480, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" },
      )
      .finished.then(() => {
        router.push(`/boutique/${b.slug}`);
        setTimeout(() => volet.remove(), 800);
      });
  }

  const n = etages.length;

  return (
    <section data-rv className="flex flex-col gap-3">
      <div className="flex min-h-[34px] items-center gap-2 px-[18px]">
        <i aria-hidden className="h-[9px] w-[9px] rounded-full" style={{ background: VIOLET }} />
        <h2 className="text-[1rem] font-extrabold tracking-[-0.2px]">{ar ? "الطوابق" : "Les étages"}</h2>
        {ouvert ? (
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="animate-monte ms-auto h-[34px] rounded-[17px] bg-[#241F2E] px-[14px] text-[0.75rem] font-extrabold text-white"
          >
            {ar ? "◱ عرض ثلاثي" : "◱ Vue 3D"}
          </button>
        ) : (
          <span className="ms-auto text-[0.75rem] font-bold text-[#767085]">
            {ar ? "المس مرّتين للدخول" : "Touchez 2× pour entrer"}
          </span>
        )}
      </div>

      <div
        ref={scene}
        data-rvi
        className="relative mx-4 h-[360px] overflow-hidden rounded-[26px] bg-[radial-gradient(120%_80%_at_50%_0%,#F4EEFB,#E6DDF1)]"
        style={{ perspective: "900px", perspectiveOrigin: "50% 0%" }}
      >
        {etages.map((e, i) => {
          const ordre = n - 1 - i;
          const estChoisi = i === choisi;
          const sous = i < choisi; // empilés RDC en bas : les étages inférieurs s'écartent
          const aPlat = ouvert && estChoisi;
          const cache = ouvert && !estChoisi;
          const top = aPlat ? 14 : 4 + ordre * 40 + (sous ? 30 : 0);
          const transform = aPlat
            ? "rotateX(0deg) rotateZ(0deg) translateZ(0px)"
            : `rotateX(58deg) rotateZ(-34deg) translateZ(${cache ? -120 : estChoisi ? 28 : 0}px)`;
          const cases = Array.from({ length: 12 }, (_, k) => e.boutiques[k] ?? null);
          return (
            <div
              key={e.niveau}
              onClick={aPlat ? undefined : () => choisir(i)}
              className="absolute"
              style={{
                left: aPlat ? 14 : 86,
                right: aPlat ? 14 : 18,
                top,
                height: aPlat ? 332 : 104,
                cursor: aPlat ? "default" : "pointer",
                transformStyle: "preserve-3d",
                transform,
                transition: `transform .7s ${EASE},top .6s ${EASE},left .7s ${EASE},right .7s ${EASE},height .7s ${EASE},opacity .45s`,
                opacity: cache ? 0 : 1,
                pointerEvents: cache ? "none" : "auto",
                zIndex: aPlat ? 10 : estChoisi ? 6 : 5 - ordre,
                direction: "ltr",
              }}
            >
              {!aPlat ? (
                <>
                  <div
                    className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-[5px] rounded-[18px] p-[10px]"
                    style={{
                      background: estChoisi ? "#fff" : "rgba(255,255,255,.78)",
                      boxShadow: estChoisi ? "0 30px 40px rgba(60,40,90,.35)" : "0 14px 24px rgba(60,40,90,.16)",
                    }}
                  >
                    {cases.map((b, k) => (
                      <span
                        key={k}
                        className={b?.live ? "animate-pulse-promo" : undefined}
                        style={{
                          borderRadius: 6,
                          background: !b ? "#EFEAF6" : b.live ? "#D0455F" : b.ouvert ? (estChoisi ? VIOLET : "#A58CC4") : "#D9D2E6",
                          boxShadow: b?.live ? "0 0 10px rgba(208,69,95,.6)" : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-[2px] rounded-[20px]"
                    style={{ boxShadow: `inset 0 0 0 2px ${estChoisi ? VIOLET : "transparent"}` }}
                  />
                </>
              ) : (
                <div
                  dir={ar ? "rtl" : "ltr"}
                  className="animate-monte absolute inset-0 flex flex-col gap-[10px] rounded-[22px] bg-white p-3 shadow-[0_0_0_2px_#6D4B8F,0_24px_40px_rgba(60,40,90,.28)]"
                  style={{ animationDelay: ".35s" }}
                >
                  <div className="flex items-center gap-2">
                    <b className="rounded-[8px] px-[9px] py-[3px] text-[0.75rem] text-white" style={{ background: VIOLET }}>
                      {code(e.niveau)}
                    </b>
                    <b className="min-w-0 flex-1 truncate text-[0.9375rem]">{nomCourt(e)}</b>
                    {e.boutiques.length > 0 && (
                      <span className="flex items-center gap-[5px] text-[0.6875rem] font-extrabold text-[#1D7A46]">
                        <i className="animate-point-vert h-[7px] w-[7px] rounded-full bg-[#2FB36B]" />
                        {ar
                          ? `${e.boutiques.filter((b) => b.ouvert).length} مفتوح`
                          : `${e.boutiques.filter((b) => b.ouvert).length} ouverte${e.boutiques.filter((b) => b.ouvert).length > 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                  {e.boutiques.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center px-6 text-center text-[0.8125rem] font-semibold text-[#767085]">
                      {ar ? "لا توجد محلات مسجّلة في هذا الطابق بعد." : "Aucune boutique inscrite à cet étage pour l’instant."}
                    </p>
                  ) : (
                    <div className="no-sb grid min-h-0 flex-1 auto-rows-[minmax(118px,1fr)] grid-cols-3 gap-[10px] overflow-y-auto">
                      {e.boutiques.map((b) => (
                        <a
                          key={b.slug}
                          href={`/boutique/${b.slug}`}
                          onClick={(ev) => entrer(ev, b)}
                          className="press relative flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[16px] px-1 text-white shadow-[0_3px_0_rgba(0,0,0,.18)]"
                          style={{ background: `oklch(.5 .13 ${b.hue})` }}
                        >
                          {b.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- logo de boutique, 40px
                            <img src={b.logo} alt="" className="h-10 w-10 rounded-full border-2 border-white/80 object-cover" />
                          ) : (
                            <b className="text-[1.25rem] font-black tracking-[-0.3px]">{monogram(b.nom)}</b>
                          )}
                          <span className="line-clamp-2 text-center text-[0.65625rem] leading-[1.15] font-bold">{b.nom}</span>
                          <i
                            className="absolute top-[7px] right-[7px] h-2 w-2 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,.85)]"
                            style={{ background: b.live ? "#D0455F" : b.ouvert ? "#2FB36B" : "#B9B3C6" }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Étiquettes, toujours à gauche (comme le handoff, même en arabe). */}
        {etages.map((e, i) => {
          const ordre = n - 1 - i;
          const top = 4 + ordre * 40 + (i < choisi ? 30 : 0) + 34;
          const actif = i === choisi;
          return (
            <button
              key={e.niveau}
              type="button"
              onClick={() => choisir(i)}
              aria-pressed={actif}
              className="absolute left-[10px] z-30 flex h-[34px] items-center gap-[6px] rounded-[17px] px-[11px] text-[0.75rem] font-extrabold shadow-[0_4px_12px_rgba(60,40,90,.14)]"
              style={{
                top,
                background: actif ? "#241F2E" : "#fff",
                color: actif ? "#fff" : "#241F2E",
                transition: `top .6s ${EASE},background .3s,opacity .3s`,
                opacity: ouvert ? 0 : 1,
                pointerEvents: ouvert ? "none" : "auto",
                direction: ar ? "rtl" : "ltr",
              }}
            >
              {code(e.niveau)}
              <span className="max-w-[64px] truncate text-[0.65625rem] font-bold opacity-75">{nomCourt(e)}</span>
            </button>
          );
        })}

        {!ouvert && (
          <div
            dir={ar ? "rtl" : "ltr"}
            className="absolute right-3 bottom-[10px] z-30 flex gap-[10px] rounded-full bg-white/95 px-[10px] py-[5px] text-[0.625rem] font-bold text-[#635C74] shadow-[0_4px_12px_rgba(60,40,90,.12)]"
          >
            {[
              [VIOLET, ar ? "مفتوح" : "Ouvert"],
              ["#D0455F", ar ? "مباشر" : "En direct"],
              ["#D9D2E6", ar ? "مغلق" : "Fermé"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <i className="h-2 w-2 rounded-[2px]" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
