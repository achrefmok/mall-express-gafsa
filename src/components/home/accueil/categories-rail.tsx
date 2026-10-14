"use client";

import Link from "next/link";

export interface TuileCategorie {
  id: string;
  nom: string;
  href: string;
  hue: number;
  photo: string | null;
  monogramme: string;
}

/**
 * Catégories (handoff) : vignettes photo de 64 px, rayon 22, contour de
 * 2,5 px en dégradé oklch(.7 .14 h) → oklch(.5 .14 h) de la teinte réelle
 * de la catégorie ; petit rebond au toucher (rien en mouvement réduit).
 */
export function CategoriesRail({ tuiles, titre }: { tuiles: TuileCategorie[]; titre: string }) {
  function rebond(e: React.PointerEvent<HTMLAnchorElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.currentTarget.querySelector("span")?.animate(
      [
        { transform: "scale(1) rotate(0)" },
        { transform: "scale(1.18) rotate(-8deg)" },
        { transform: "scale(.94) rotate(4deg)" },
        { transform: "scale(1) rotate(0)" },
      ],
      { duration: 480, easing: "ease-out" },
    );
  }

  return (
    <section data-rv className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-[18px]">
        <i aria-hidden className="h-[9px] w-[9px] rounded-full bg-[#6D4B8F]" />
        <h2 className="text-[1rem] font-extrabold tracking-[-0.2px]">{titre}</h2>
      </div>
      <div className="no-sb flex gap-[6px] overflow-x-auto px-[14px] pb-[2px]">
        {tuiles.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            data-rvi
            onPointerDown={rebond}
            className="flex w-[72px] flex-none flex-col items-center gap-[6px] text-[#241F2E]"
          >
            <span
              className="relative h-16 w-16 rounded-[22px] p-[2.5px] shadow-[0_6px_14px_rgba(60,40,90,.14)]"
              style={{ background: `linear-gradient(140deg,oklch(.7 .14 ${c.hue}),oklch(.5 .14 ${c.hue}))` }}
            >
              <span
                className="flex h-full w-full items-center justify-center overflow-hidden rounded-[20px] border-2 border-white text-[0.875rem] font-black text-white"
                style={{ background: `oklch(.6 .12 ${c.hue})` }}
              >
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette 64px
                  <img src={c.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  c.monogramme
                )}
              </span>
            </span>
            <span className="max-w-[72px] truncate text-[0.6875rem] font-bold">{c.nom}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
