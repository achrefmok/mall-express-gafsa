"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { PinIcon } from "@/components/ui/icons";
import { formatTime } from "@/lib/format";
import type { AppLocale } from "@/types/database";

/**
 * La couverture de 200px du handoff, avec un léger relief qui suit le doigt
 * ou l'inclinaison du téléphone (rotateY ±6°, rotateX ±4°, scale 1.06,
 * lissage 0,08 par image, oscillation lente). Rien sous
 * `prefers-reduced-motion`, et la boucle s'arrête hors écran.
 */
export function CouvertureRelief({ src, children }: { src: string | null; children?: ReactNode }) {
  const cadre = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cadre.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cibleX = 0;
    let cibleY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let visible = true;

    const image = (t: number) => {
      x += (cibleX - x) * 0.08;
      y += (cibleY - y) * 0.08;
      const oscille = Math.sin(t / 1700) * 0.6;
      if (plan.current) {
        plan.current.style.transform = `perspective(900px) rotateY(${(x * 6 + oscille).toFixed(2)}deg) rotateX(${(-y * 4).toFixed(2)}deg) scale(1.06)`;
      }
      raf = visible && !document.hidden ? requestAnimationFrame(image) : 0;
    };
    const relancer = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(image);
    };

    const onPointer = (e: PointerEvent) => {
      cibleX = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
      cibleY = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      cibleX = Math.max(-1, Math.min(1, e.gamma / 25));
      cibleY = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    };
    const observateur = new IntersectionObserver(([entree]) => {
      visible = entree.isIntersecting;
      relancer();
    });
    observateur.observe(el);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    document.addEventListener("visibilitychange", relancer);
    raf = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(raf);
      observateur.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrientation);
      document.removeEventListener("visibilitychange", relancer);
    };
  }, []);

  return (
    <div ref={cadre} className="relative h-[200px] w-full flex-none overflow-hidden bg-[var(--theme-accent-doux)]">
      <div ref={plan} className="absolute -inset-4 will-change-transform">
        {src ? (
          <Image src={src} alt="" fill priority sizes="(max-width: 520px) 100vw, 520px" className="object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(60% 80% at 30% 20%,color-mix(in srgb,var(--theme-accent) 55%,#fff),transparent 70%),linear-gradient(160deg,var(--theme-accent),color-mix(in srgb,var(--theme-accent) 55%,#120d17))",
            }}
          />
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(20,14,26,.4),transparent_50%)]" />
      {children}
    </div>
  );
}

const JOURS_AR = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];
const JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export interface HoraireJour {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
}

/**
 * Le bloc d'infos du handoff : statut (point pulsé, « مفتوح الآن · يغلق
 * HH:00 ») avec « المواعيد ‹ » qui déplie la semaine réelle, puis
 * l'emplacement avec « الخريطة ‹ ». Chaque ligne n'apparaît qu'avec ses
 * données : pas d'horaire saisi, pas de « المواعيد » ; pas de coordonnées,
 * pas de lien vers la carte.
 */
export function BlocInfos({
  ouvert,
  horaires,
  emplacement,
  sousEmplacement,
  lienCarte,
  locale,
}: {
  ouvert: boolean;
  horaires: HoraireJour[];
  emplacement: string | null;
  sousEmplacement: string | null;
  lienCarte: string | null;
  locale: AppLocale;
}) {
  const [deplie, setDeplie] = useState(false);
  const ar = locale === "ar";
  const aujourdhui = (new Date().getDay() + 6) % 7;
  const jour = horaires.find((h) => h.weekday === aujourdhui);
  const prochain = [1, 2, 3, 4, 5, 6, 7]
    .map((d) => horaires.find((h) => h.weekday === (aujourdhui + d) % 7))
    .find((h) => h && !h.is_closed && h.opens_at);

  let statut = ar ? (ouvert ? "مفتوح الآن" : "مغلق الآن") : ouvert ? "Ouvert maintenant" : "Fermé maintenant";
  if (ouvert && jour?.closes_at) statut += ` · ${ar ? "يغلق" : "ferme à"} ${formatTime(jour.closes_at)}`;
  else if (!ouvert) {
    const ouvreAujourdhui = jour && !jour.is_closed && jour.opens_at;
    const h = ouvreAujourdhui ? jour : prochain;
    if (h?.opens_at) statut += ` · ${ar ? "يفتح" : "ouvre à"} ${formatTime(h.opens_at)}`;
  }

  const couleur = ouvert ? "#1d7a46" : "var(--theme-muted)";
  const fond = ouvert ? "#e2f5ea" : "color-mix(in srgb,var(--theme-muted) 14%,#fff)";
  const ligne = "flex min-h-[48px] w-full items-center gap-[10px] px-3 text-start";

  return (
    <div className="flex flex-col rounded-[16px] bg-[var(--theme-fond)]">
      <button
        type="button"
        onClick={() => horaires.length > 0 && setDeplie((d) => !d)}
        aria-expanded={horaires.length > 0 ? deplie : undefined}
        className={`${ligne} ${emplacement ? "border-b border-[rgba(60,40,90,.07)]" : ""}`}
      >
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px]" style={{ background: fond, color: couleur }}>
          <i className={`h-2 w-2 rounded-full bg-current ${ouvert ? "animate-point-statut" : ""}`} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold" style={{ color: couleur }}>
          {statut}
        </span>
        {horaires.length > 0 && (
          <span className="flex-none text-[0.75rem] font-semibold whitespace-nowrap text-[var(--theme-muted)]">
            {ar ? "المواعيد" : "Horaires"} {deplie ? "⌄" : "‹"}
          </span>
        )}
      </button>

      {deplie && (
        <ul className="flex flex-col gap-[2px] border-b border-[rgba(60,40,90,.07)] px-3 pb-[10px] text-[0.75rem]">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const h = horaires.find((x) => x.weekday === d);
            const ferme = !h || h.is_closed || !h.opens_at || !h.closes_at;
            return (
              <li key={d} className={`flex justify-between gap-2 py-[3px] ${d === aujourdhui ? "font-bold" : ""}`}>
                <span>{(ar ? JOURS_AR : JOURS_FR)[d]}</span>
                <span dir="ltr" className="text-[var(--theme-muted)]">
                  {ferme ? (ar ? "مغلق" : "Fermé") : `${formatTime(h.opens_at!)} – ${formatTime(h.closes_at!)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {emplacement &&
        (lienCarte ? (
          <a href={lienCarte} target="_blank" rel="noreferrer" className={ligne}>
            <ContenuEmplacement emplacement={emplacement} sous={sousEmplacement} />
            <span className="flex-none text-[0.75rem] font-extrabold whitespace-nowrap text-[var(--theme-accent-fort)]">
              {ar ? "الخريطة" : "Carte"} ‹
            </span>
          </a>
        ) : (
          <div className={ligne}>
            <ContenuEmplacement emplacement={emplacement} sous={sousEmplacement} />
          </div>
        ))}
    </div>
  );
}

function ContenuEmplacement({ emplacement, sous }: { emplacement: string; sous: string | null }) {
  return (
    <>
      <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] bg-[var(--theme-accent-doux)] text-[var(--theme-accent-fort)]">
        <PinIcon size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
        <span className="truncate text-[0.8125rem] font-bold">{emplacement}</span>
        {sous && <span className="truncate text-[0.6875rem] text-[var(--theme-muted)]">{sous}</span>}
      </span>
    </>
  );
}
