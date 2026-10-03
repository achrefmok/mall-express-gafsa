"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";

/**
 * L'aperçu qui change de métier sous les yeux.
 *
 * Une seule maquette de téléphone qui cycle entre six vitrines — chacune
 * avec sa propre structure (taille pour la mode, teinte pour la beauté,
 * comparatif pour le high-tech…), pour montrer d'un coup d'œil que
 * `theme.productLayout` change vraiment par métier, pas seulement la
 * couleur. Demandé explicitement sur une maquette de référence très
 * détaillée ; simplifié ici à quatre structures bien distinctes plutôt que
 * six quasi identiques, pour rester lisible et maintenable.
 *
 * Mêmes photos que `/marketplace` (public/images/cat-*.jpg) : jamais une
 * image inventée pour l'occasion.
 */

type CatId = "mode" | "beaute" | "electro" | "maison";

const CATS: Array<{ id: CatId; label: string; hue: number; image: string }> = [
  { id: "mode", label: "Mode", hue: 300, image: "/images/cat-mode.jpg" },
  { id: "beaute", label: "Beauté", hue: 330, image: "/images/cat-beaute.jpg" },
  { id: "electro", label: "High-tech", hue: 210, image: "/images/cat-electro.jpg" },
  { id: "maison", label: "Maison", hue: 25, image: "/images/cat-maison.jpg" },
];

const ROTATE_MS = 3200;
const HOLD_MS = 9000;

export function HeroMockup() {
  const [index, setIndex] = useState(0);
  const holdUntil = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (Date.now() < holdUntil.current) return;
      setIndex((i) => (i + 1) % CATS.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  function pick(i: number) {
    holdUntil.current = Date.now() + HOLD_MS;
    setIndex(i);
  }

  const cat = CATS[index];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[280px] rounded-[34px] border border-[var(--color-surface-edge)] bg-[var(--color-app)] p-3 shadow-[0_30px_70px_rgba(60,40,90,0.20)] sm:w-[320px]">
        <div className="flex flex-col gap-3 rounded-[26px] bg-[var(--color-field)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
              G-<span className="text-[var(--color-brand)]">Mall</span>
            </p>
            <span
              className="cat-surface cat-ink rounded-[10px] px-2 py-[3px] text-[0.5625rem] font-bold transition-colors duration-500"
              style={{ "--hue": cat.hue } as React.CSSProperties}
            >
              {cat.label}
            </span>
          </div>

          <div className="relative h-[150px] overflow-hidden rounded-[18px]">
            <Image
              key={cat.id}
              src={cat.image}
              alt=""
              fill
              sizes="320px"
              className="fade-in-img object-cover"
            />
          </div>

          <div key={cat.id} className="animate-slide-up flex flex-col gap-3">
            {cat.id === "mode" && (
              <>
                <div>
                  <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">Robe d&apos;été</p>
                  <p className="text-[0.625rem] text-[var(--color-muted)]">Maison Lina · 139 DT</p>
                </div>
                <div className="flex gap-[6px]">
                  {["S", "M", "L", "XL"].map((taille) => (
                    <span
                      key={taille}
                      className={cx(
                        "flex-1 rounded-[8px] py-[5px] text-center text-[0.5625rem] font-bold",
                        taille === "M"
                          ? "bg-[var(--color-brand-fill)] text-white"
                          : "border border-[var(--color-outline)] text-[var(--color-ink)]",
                      )}
                    >
                      {taille}
                    </span>
                  ))}
                </div>
              </>
            )}

            {cat.id === "beaute" && (
              <>
                <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">Trouver ma teinte</p>
                <div className="flex justify-between">
                  {["#f6dcc6", "#ecc4a2", "#d9a57c", "#c08a5f", "#9a6640"].map((teinte, i) => (
                    <span
                      key={teinte}
                      className="h-[26px] w-[26px] rounded-full"
                      style={{
                        background: teinte,
                        boxShadow: i === 2 ? "0 0 0 2px var(--color-app), 0 0 0 4px var(--color-brand-fill)" : undefined,
                      }}
                    />
                  ))}
                </div>
                <p className="rounded-[9px] bg-[var(--color-brand-tint)] px-2 py-[5px] text-[0.5625rem] text-[var(--color-ink)]">
                  Teinte conseillée : <b>230 Beige doré</b>
                </p>
              </>
            )}

            {cat.id === "electro" && (
              <div className="flex flex-col gap-[6px]">
                {[
                  { n: "Galaxy A55", spec: "128 Go", prix: "1 249 DT" },
                  { n: "Redmi Note 13", spec: "256 Go", prix: "899 DT" },
                ].map((p) => (
                  <div key={p.n} className="flex items-center gap-[8px] rounded-[12px] bg-[var(--color-surface-solid)] p-[7px]">
                    <span className="h-[34px] w-[26px] flex-none rounded-[8px] bg-[var(--color-track)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.625rem] font-bold text-[var(--color-ink)]">{p.n}</p>
                      <span className="rounded-[5px] bg-[var(--color-brand-tint)] px-[5px] py-[1px] text-[0.5rem] font-bold text-[var(--color-brand)]">
                        {p.spec}
                      </span>
                    </div>
                    <span className="flex-none text-[0.625rem] font-bold text-[var(--color-ink)]">{p.prix}</span>
                  </div>
                ))}
              </div>
            )}

            {cat.id === "maison" && (
              <>
                <div className="rounded-[14px] bg-[var(--color-surface-solid)]">
                  <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-[10px] py-[7px] text-[0.59375rem]">
                    <span>
                      <b>1</b> Canapé · L 220 cm
                    </span>
                    <b>2 450 DT</b>
                  </div>
                  <div className="flex items-center justify-between px-[10px] py-[7px] text-[0.59375rem]">
                    <span>
                      <b>2</b> Table basse · chêne
                    </span>
                    <b>590 DT</b>
                  </div>
                </div>
                <span className="rounded-[14px] bg-[var(--color-brand-fill)] px-3 py-[8px] text-center text-[0.59375rem] font-bold text-white">
                  Ajouter l&apos;ambiance · 3 460 DT
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-[6px]">
        {CATS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(i)}
            className={cx(
              "rounded-[14px] px-3 py-[7px] text-[0.75rem] font-bold transition-colors duration-300",
              i === index
                ? "bg-[var(--color-brand-fill)] text-white"
                : "border border-[var(--color-outline)] text-[var(--color-muted)]",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
