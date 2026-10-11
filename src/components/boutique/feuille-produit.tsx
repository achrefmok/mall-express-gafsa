"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { lienProduit } from "@/lib/product-url";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./layouts/types";

/**
 * Le fond d'un produit sans photo : ses couleurs réelles (`products.colors`),
 * sinon l'accent de la boutique. Le même partout (feuille, catalogues).
 */
export function fondSansPhoto(p: { colors?: string[] }): string {
  const [a, b] = p.colors ?? [];
  if (a) return `linear-gradient(160deg,${a},${b ?? `color-mix(in srgb,${a} 70%,#000)`})`;
  return "linear-gradient(160deg,var(--theme-accent),color-mix(in srgb,var(--theme-accent) 60%,#000))";
}

/**
 * La feuille produit du handoff : elle monte du bas (.28s
 * cubic-bezier(.22,.61,.36,1)) sur un voile rgba(20,14,26,.45), ouverte
 * depuis le présentoir, la plaque « في الواجهة الآن » ou le catalogue.
 *
 * Socle commun (photo, nom, prix, taille, ajout au panier, lien vers la
 * fiche complète) ; chaque métier y glisse son propre bloc (`children` :
 * pyramide olfactive, fiche technique, compatibilité…).
 */
export function FeuilleProduit({
  produit,
  locale,
  onFermer,
  onAjouter,
  pending,
  tailleRequise = false,
  sousTitre,
  children,
  prixAffiche,
  visuel,
}: {
  produit: ProduitBoutique | null;
  locale: AppLocale;
  onFermer: () => void;
  /** Ajoute au panier — la taille choisie si le produit en a. */
  onAjouter: (taille: string | null) => void;
  pending: boolean;
  /** Sport, Mode : pas d'ajout sans taille quand le produit en déclare. */
  tailleRequise?: boolean;
  sousTitre?: ReactNode;
  children?: ReactNode;
  /** Remplace le prix (location : prix × jours). */
  prixAffiche?: string;
  /**
   * Grand visuel pleine largeur en tête de feuille (Téléphones : le produit
   * en 3D qu'on fait tourner) — remplace alors la petite vignette.
   */
  visuel?: ReactNode;
}) {
  /*
    Montée à chaque nouveau produit : le composant interne est remonté par
    sa clé, la taille choisie repart donc de zéro sans effet à synchroniser.
  */
  if (!produit) return null;
  return (
    <Feuille
      key={produit.id}
      produit={produit}
      locale={locale}
      onFermer={onFermer}
      onAjouter={onAjouter}
      pending={pending}
      tailleRequise={tailleRequise}
      sousTitre={sousTitre}
      prixAffiche={prixAffiche}
      visuel={visuel}
    >
      {children}
    </Feuille>
  );
}

function Feuille({
  produit,
  locale,
  onFermer,
  onAjouter,
  pending,
  tailleRequise,
  sousTitre,
  children,
  prixAffiche,
  visuel,
}: {
  produit: ProduitBoutique;
  locale: AppLocale;
  onFermer: () => void;
  onAjouter: (taille: string | null) => void;
  pending: boolean;
  tailleRequise: boolean;
  sousTitre?: ReactNode;
  children?: ReactNode;
  prixAffiche?: string;
  visuel?: ReactNode;
}) {
  const [monte, setMonte] = useState(false);
  const [taille, setTaille] = useState<string | null>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const onFermerRef = useRef(onFermer);
  useEffect(() => {
    onFermerRef.current = onFermer;
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => setMonte(true));
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fermer.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermerRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = precedent;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const tailles = produit.sizes ?? [];
  const manqueTaille = tailleRequise && tailles.length > 0 && !taille;
  const rupture = produit.stock <= 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={produit.name}>
      <button
        type="button"
        aria-label={locale === "ar" ? "إغلاق" : "Fermer"}
        onClick={onFermer}
        className="absolute inset-0 bg-[rgba(20,14,26,.45)] transition-opacity duration-[280ms]"
        style={{ opacity: monte ? 1 : 0 }}
      />
      <div
        className="relative mx-auto flex max-h-[88dvh] w-full max-w-[520px] flex-col overflow-y-auto rounded-t-[28px] bg-[var(--theme-surface,#fff)] pb-[max(16px,env(safe-area-inset-bottom))] text-[var(--theme-texte,var(--color-ink))]"
        style={{
          transform: monte ? "translateY(0)" : "translateY(100%)",
          transition: "transform .28s cubic-bezier(.22,.61,.36,1)",
        }}
      >
        <span className="mx-auto mt-[10px] h-[5px] w-[42px] flex-none rounded-full bg-[var(--theme-bordure,rgba(60,40,90,.16))]" />
        {visuel && <div className="px-4 pt-3">{visuel}</div>}
        <div className="flex items-start gap-3 px-4 pt-3">
          {!visuel && (
          <div
            className="relative h-[112px] w-[112px] flex-none overflow-hidden rounded-[18px] bg-[var(--theme-accent-doux)]"
          >
            {produit.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- vignette fixe 112px
              <img src={produit.images[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="absolute inset-0 flex items-center justify-center p-2 text-center text-[1rem] font-black text-white"
                style={{ background: fondSansPhoto(produit) }}
              >
                {produit.name.split(/[\s—–-]+/)[0]}
              </span>
            )}
          </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[1.0625rem] leading-[1.3] font-extrabold">{produit.name}</span>
            {sousTitre && <span className="text-[0.75rem] text-[var(--theme-muted)]">{sousTitre}</span>}
            <span className="flex items-baseline gap-2">
              <span className="text-[1.25rem] font-black text-[var(--theme-accent-fort)]">
                {prixAffiche ?? formatPrice(produit.price, locale)}
              </span>
              {!prixAffiche && produit.compare_at_price && produit.compare_at_price > produit.price && (
                <span className="text-[0.75rem] text-[var(--theme-muted)] line-through">
                  {formatPrice(produit.compare_at_price, locale)}
                </span>
              )}
            </span>
          </div>
          <button
            ref={fermer}
            type="button"
            onClick={onFermer}
            aria-label={locale === "ar" ? "إغلاق" : "Fermer"}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--theme-accent-doux)] text-[1rem] font-bold text-[var(--theme-accent-fort)]"
          >
            ✕
          </button>
        </div>

        {children && <div className="flex flex-col gap-3 px-4 pt-4">{children}</div>}

        {tailles.length > 0 && (
          <div className="flex flex-col gap-2 px-4 pt-4">
            <span className="text-[0.8125rem] font-extrabold">{locale === "ar" ? "المقاس" : "Taille"}</span>
            <div className="flex flex-wrap gap-[6px]">
              {tailles.map((s) => {
                const actif = s === taille;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTaille(actif ? null : s)}
                    aria-pressed={actif}
                    className="min-h-[38px] min-w-[46px] rounded-[12px] px-3 text-[0.8125rem] font-bold"
                    style={{
                      background: actif ? "var(--theme-accent)" : "var(--theme-surface,#fff)",
                      color: actif ? "var(--theme-accent-texte)" : "var(--theme-texte)",
                      border: `1px solid ${actif ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 px-4 pt-5">
          <Link
            href={lienProduit(produit)}
            className="flex min-h-[48px] flex-none items-center justify-center rounded-[14px] border border-[var(--theme-bordure)] px-4 text-[0.8125rem] font-bold text-[var(--theme-accent-fort)]"
          >
            {locale === "ar" ? "الصفحة الكاملة" : "Voir la fiche"}
          </Link>
          <button
            type="button"
            disabled={pending || manqueTaille || rupture}
            onClick={() => onAjouter(taille)}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-[var(--theme-accent)] px-4 text-[0.875rem] font-extrabold text-[var(--theme-accent-texte)] disabled:opacity-50"
          >
            {rupture
              ? locale === "ar"
                ? "نفد المخزون"
                : "Rupture de stock"
              : manqueTaille
                ? locale === "ar"
                  ? "اختر المقاس"
                  : "Choisissez une taille"
                : locale === "ar"
                  ? "أضف إلى السلة"
                  : "Ajouter au panier"}
          </button>
        </div>
      </div>
    </div>
  );
}
