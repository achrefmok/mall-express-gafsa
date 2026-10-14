"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AppLocale } from "@/types/database";

export interface PromoCadeau {
  pourcent: number;
  titre: string;
  boutique: string;
  slug: string;
  fin: string;
}

/**
 * « Cadeau du jour » (handoff) : une carte à gratter du doigt. Pas de faux
 * code promo — décision de l'utilisateur : elle révèle une vraie promotion
 * en cours (boutique, remise, date de fin réelles), choisie chaque jour
 * parmi celles qui sont actives. Au-delà de 45 % gratté, le reste s'efface.
 * Sous `prefers-reduced-motion`, la carte est déjà découverte.
 */
export function CadeauGratter({ promo, locale }: { promo: PromoCadeau; locale: AppLocale }) {
  const ar = locale === "ar";
  const toile = useRef<HTMLCanvasElement>(null);
  const [revele, setRevele] = useState(false);
  const gratte = useRef(false);

  useEffect(() => {
    const cv = toile.current;
    if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevele(true);
      return;
    }
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, "#C8B6DE");
    g.addColorStop(0.5, "#E9E0F4");
    g.addColorStop(1, "#B9A3D3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * r.width, Math.random() * r.height, 2, 2);
    ctx.fillStyle = "#3E2A56";
    ctx.font = "800 16px Cairo, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ar ? "✦ اكشط هنا" : "Grattez ici ✦", r.width / 2, r.height / 2);
  }, [ar]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const cv = toile.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const r = cv.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(e.clientX - r.left, e.clientY - r.top, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function verifier() {
    const cv = toile.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let vide = 0;
    for (let i = 3; i < d.length; i += 64) if (d[i] === 0) vide++;
    if (vide / (d.length / 64) > 0.45) setRevele(true);
  }

  const fin = new Date(promo.fin).toLocaleDateString(ar ? "ar-TN" : "fr-FR", { day: "numeric", month: "long" });

  return (
    <section data-rv className="mx-4 flex flex-col gap-[10px]">
      <div className="flex items-center gap-2 px-[2px]">
        <i aria-hidden className="h-[9px] w-[9px] rounded-full bg-[#D0455F]" />
        <h2 className="text-[1rem] font-extrabold tracking-[-0.2px]">{ar ? "هديّة اليوم" : "Cadeau du jour"}</h2>
        <span className="ms-auto text-[0.6875rem] font-bold text-[#767085]">{ar ? "اكشط بإصبعك" : "Grattez avec le doigt"}</span>
      </div>
      <div className="relative h-[120px] overflow-hidden rounded-[24px] bg-white shadow-[0_10px_26px_rgba(60,40,90,.1)]">
        <Link
          href={`/boutique/${promo.slug}`}
          tabIndex={revele ? 0 : -1}
          className="absolute inset-0 flex items-center gap-[14px] bg-[radial-gradient(circle_at_15%_50%,rgba(208,69,95,.1),transparent_60%)] px-4 py-[14px]"
        >
          <span
            dir="ltr"
            className="flex h-[84px] w-[84px] flex-none flex-col items-center justify-center rounded-full bg-[#D0455F] leading-none text-white shadow-[0_10px_22px_rgba(208,69,95,.4)]"
          >
            <b className="text-[1.625rem] tracking-[-1px]">−{promo.pourcent}%</b>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <b className="line-clamp-2 text-[0.9375rem] leading-[1.25] text-[#241F2E]">
              {ar ? `${promo.boutique} تهديك −${promo.pourcent}%` : `${promo.boutique} vous offre −${promo.pourcent} %`}
            </b>
            <span className="truncate text-[0.75rem] font-bold text-[#6D4B8F]">{promo.titre}</span>
            <span className="text-[0.6875rem] font-semibold text-[#767085]">
              {ar ? `صالحة حتى ${fin}` : `Valable jusqu’au ${fin}`}
            </span>
          </span>
        </Link>
        <canvas
          ref={toile}
          aria-label={ar ? "اكشط لاكتشاف الهديّة" : "Grattez pour découvrir le cadeau"}
          role="img"
          onPointerDown={(e) => {
            gratte.current = true;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // capture refusée : le grattage marche quand même
            }
            point(e);
          }}
          onPointerMove={(e) => gratte.current && point(e)}
          onPointerUp={() => {
            gratte.current = false;
            verifier();
          }}
          onPointerLeave={() => {
            if (!gratte.current) return;
            gratte.current = false;
            verifier();
          }}
          className="absolute inset-0 h-full w-full cursor-grab touch-none transition-opacity duration-500"
          style={{ opacity: revele ? 0 : 1, pointerEvents: revele ? "none" : "auto" }}
        />
      </div>
    </section>
  );
}
