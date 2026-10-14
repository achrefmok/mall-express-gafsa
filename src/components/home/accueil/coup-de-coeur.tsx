"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/app/actions/cart";
import { formatPrice } from "@/lib/format";
import { lienProduit } from "@/lib/product-url";
import type { AppLocale } from "@/types/database";

export interface CarteCoeur {
  id: string;
  name: string;
  name_ar: string | null;
  price: number;
  image: string;
  boutique: string;
}

const SEUIL = 90;

/**
 * « Coup de cœur du jour » (handoff) : une pile de trois cartes produit.
 * Glisser fait pencher la carte (rotate = dx/18) et montre « J'AIME » /
 * « PASSER » (opacité |dx|/80) ; au-delà de 90 px elle sort en 300 ms,
 * sinon elle revient. Droite = aimer, aussi en arabe. Un « j'aime » ajoute
 * vraiment le produit aux favoris (personne connectée) ; un toucher sans
 * glisser ouvre la fiche.
 */
export function CoupDeCoeur({
  cartes,
  locale,
  connecte,
}: {
  cartes: CarteCoeur[];
  locale: AppLocale;
  connecte: boolean;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [aimes, setAimes] = useState(0);
  const dessus = useRef<HTMLDivElement>(null);
  const geste = useRef<{ x0: number; dx: number } | null>(null);
  const enVol = useRef(false);

  if (cartes.length === 0) return null;
  const fini = index >= cartes.length;

  function etiquettes(dx: number) {
    const el = dessus.current;
    if (!el) return;
    const j = el.querySelector<HTMLElement>("[data-like]");
    const p = el.querySelector<HTMLElement>("[data-pass]");
    if (j) j.style.opacity = String(Math.max(0, Math.min(1, dx / 80)));
    if (p) p.style.opacity = String(Math.max(0, Math.min(1, -dx / 80)));
  }

  function sortir(aime: boolean) {
    const el = dessus.current;
    const carte = cartes[index];
    if (!el || !carte || enVol.current) return;
    enVol.current = true;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.style.transition = reduit ? "none" : "transform .3s cubic-bezier(.2,.8,.2,1)";
    el.style.transform = `translateX(${aime ? 460 : -460}px) rotate(${aime ? 26 : -26}deg)`;
    etiquettes(aime ? 80 : -80);
    if (aime) {
      setAimes((n) => n + 1);
      if (connecte) void toggleFavorite(carte.id, false);
    }
    setTimeout(
      () => {
        enVol.current = false;
        setIndex((i) => i + 1);
      },
      reduit ? 0 : 300,
    );
  }

  function onDown(e: React.PointerEvent) {
    if (!dessus.current || enVol.current) return;
    geste.current = { x0: e.clientX, dx: 0 };
    dessus.current.style.transition = "none";
  }
  function onMove(e: React.PointerEvent) {
    const g = geste.current;
    const el = dessus.current;
    if (!g || !el) return;
    g.dx = e.clientX - g.x0;
    el.style.transform = `translateX(${g.dx}px) rotate(${g.dx / 18}deg)`;
    etiquettes(g.dx);
    if (Math.abs(g.dx) > 6 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture refusée : le geste marche quand même
      }
    }
  }
  function onUp() {
    const g = geste.current;
    const el = dessus.current;
    geste.current = null;
    if (!g || !el) return;
    if (Math.abs(g.dx) > SEUIL) return sortir(g.dx > 0);
    el.style.transition = "transform .3s cubic-bezier(.2,.8,.2,1)";
    el.style.transform = "none";
    etiquettes(0);
    if (Math.abs(g.dx) < 6) router.push(lienProduit(cartes[index]));
  }

  const pile = cartes.slice(index, index + 3);

  return (
    <section data-rv className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-[18px]">
        <i aria-hidden className="h-[9px] w-[9px] rounded-full bg-[#D0455F]" />
        <h2 className="text-[1rem] font-extrabold tracking-[-0.2px]">{ar ? "إعجاب اليوم" : "Coup de cœur du jour"}</h2>
        <span className="ms-auto flex items-center gap-[5px] rounded-full bg-[#FBE7EB] px-[10px] py-[3px] text-[0.75rem] font-black text-[#D0455F]">
          ♥ {aimes}
        </span>
      </div>
      <span className="-mt-[6px] px-[18px] text-[0.75rem] font-semibold text-[#767085]">
        {ar ? "اسحب يمينا للإعجاب، يسارا للتخطّي" : "Glissez à droite pour aimer, à gauche pour passer"}
      </span>

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative mx-[30px] mb-2 h-[300px] touch-pan-y select-none"
      >
        {!fini &&
          pile
            .map((c, k) => (
              <div
                key={c.id}
                ref={k === 0 ? dessus : undefined}
                className="absolute inset-0 cursor-grab overflow-hidden rounded-[26px] bg-[#3E2A56] shadow-[0_16px_34px_rgba(60,40,90,.22)]"
                style={{
                  zIndex: 3 - k,
                  transform: k === 0 ? "none" : `translateY(${k * 12}px) scale(${1 - k * 0.05})`,
                  transition: "transform .3s cubic-bezier(.2,.8,.2,1)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- carte de 300px, image du produit */}
                <img src={c.image} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(20,14,26,.85),transparent_55%)]" />
                <span
                  data-like
                  className="absolute top-[22px] left-[18px] -rotate-[14deg] rounded-[10px] border-[3px] border-[#2FB36B] bg-white/85 px-3 py-1 text-[1.25rem] font-black text-[#2FB36B] opacity-0"
                >
                  {ar ? "أعجبني" : "J’AIME"}
                </span>
                <span
                  data-pass
                  className="absolute top-[22px] right-[18px] rotate-[14deg] rounded-[10px] border-[3px] border-[#D0455F] bg-white/85 px-3 py-1 text-[1.25rem] font-black text-[#D0455F] opacity-0"
                >
                  {ar ? "تخطّي" : "PASSER"}
                </span>
                <span className="absolute inset-x-[18px] bottom-4 flex flex-col gap-[2px] leading-[1.2] text-white">
                  <span className="text-[0.6875rem] font-bold opacity-80">{c.boutique}</span>
                  <b className="line-clamp-2 text-[1.25rem] tracking-[-0.3px]">{ar && c.name_ar ? c.name_ar : c.name}</b>
                  <b className="text-[1.0625rem] text-[#F29BB0]">{formatPrice(c.price, locale)}</b>
                </span>
              </div>
            ))
            .reverse()}

        {fini && (
          <div className="animate-monte absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[26px] bg-[linear-gradient(150deg,#7E58A6,#3E2A56)] p-6 text-center text-white">
            <span className="animate-pulse-promo flex h-16 w-16 items-center justify-center rounded-full bg-white text-[1.875rem] text-[#D0455F]">
              ♥
            </span>
            <b className="text-[1.125rem] leading-[1.3]">
              {aimes === 0
                ? ar
                  ? "لم يعجبك شيء؟ عد غدا"
                  : "Rien ne vous a plu ? Revenez demain"
                : connecte
                  ? ar
                    ? `أضفنا ${aimes} إلى مفضّلتك`
                    : `${aimes} coup${aimes > 1 ? "s" : ""} de cœur ajouté${aimes > 1 ? "s" : ""} à vos favoris`
                  : ar
                    ? "سجّل الدخول لحفظ ما أعجبك"
                    : "Connectez-vous pour garder vos coups de cœur"}
            </b>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setAimes(0);
                }}
                className="h-[42px] rounded-[21px] bg-white px-[18px] text-[0.8125rem] font-extrabold text-[#241F2E]"
              >
                {ar ? "من جديد" : "Recommencer"}
              </button>
              {aimes > 0 && (
                <Link
                  href={connecte ? "/profil/favoris" : "/connexion?suite=/accueil"}
                  className="flex h-[42px] items-center rounded-[21px] border border-white/40 px-[18px] text-[0.8125rem] font-extrabold"
                >
                  {connecte ? (ar ? "مفضّلتي" : "Mes favoris") : ar ? "دخول" : "Connexion"}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {!fini && (
        <div dir="ltr" className="flex items-center justify-center gap-[22px]">
          <button
            type="button"
            onClick={() => sortir(false)}
            aria-label={ar ? "تخطّي" : "Passer"}
            className="press h-[54px] w-[54px] rounded-full bg-white text-[1.375rem] font-black text-[#D0455F] shadow-[0_8px_20px_rgba(60,40,90,.14)]"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={() => sortir(true)}
            aria-label={ar ? "أعجبني" : "J'aime"}
            className="press h-16 w-16 rounded-full bg-[linear-gradient(140deg,#D0455F,#6D4B8F)] text-[1.625rem] text-white shadow-[0_10px_24px_rgba(208,69,95,.4)]"
          >
            ♥
          </button>
        </div>
      )}
    </section>
  );
}
