"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { correspondOption, texteFiltrable, type ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

/** Les teintes réelles du produit (`products.colors`), en pastilles. */
function Teintes({ p, grandes }: { p: ProduitBoutique; grandes?: boolean }) {
  const teintes = (p.colors ?? []).slice(0, grandes ? 12 : 6);
  if (teintes.length === 0) return null;
  const d = grandes ? 22 : 14;
  return (
    <span className="flex flex-wrap gap-[5px]">
      {teintes.map((c) => (
        <i
          key={c}
          title={c}
          className="rounded-full shadow-[0_0_0_2px_var(--theme-surface,#fff),0_0_0_3px_var(--theme-bordure)]"
          style={{ width: d, height: d, background: c }}
        />
      ))}
    </span>
  );
}

/**
 * Cosmétiques — vitrine ajoutée le 2026-10-12 (sans maquette dans le
 * handoff, à la demande de l'utilisateur) : coiffeuse lumineuse rose
 * poudré, filtre « احتياجي » (maquillage, soin, cheveux, corps — lu dans
 * l'attribut `besoin`, sinon la sous-catégorie et le nom), grille de deux
 * colonnes avec les teintes et le type de peau réellement déclarés.
 *
 * Contenances : les déclinaisons réelles (`products.sizes`), au même prix.
 */
export function CosmetiquesLayout({
  visible,
  locale,
  theme,
  vitrine,
  nomBoutique,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  vitrine: ConfigVitrine;
  nomBoutique: string;
}) {
  const ar = locale === "ar";
  const etat = useVitrine(visible, vitrine);
  const panier = useAjoutPanier();
  const [contenance, setContenance] = useState<Record<string, string>>({});

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  /* Le besoin affiché : l'option du filtre que le produit porte vraiment. */
  const besoinDe = (p: ProduitBoutique) => {
    const texte = texteFiltrable(p, vitrine.filtre);
    const o = vitrine.filtre.options.find((opt) => correspondOption(opt, texte));
    return o ? (ar ? o.ar : o.fr) : null;
  };

  function ajouter(p: ProduitBoutique, taille: string | null = null) {
    const choix = taille ?? (contenance[p.id] || null);
    if ((p.sizes ?? []).length > 0 && !choix) {
      etat.ouvrir(p.id);
      return;
    }
    panier.ajouter([{ productId: p.id, size: choix }], etat.fermer);
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => [p.attributs?.marque, besoinDe(p)].filter(Boolean).join(" · ") || null}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "منتجات التجميل" : "La beauté"} · {visible.length}
      </span>

      <div className="grid grid-cols-2 gap-[10px]">
        {visible.map((p) => {
          const besoin = besoinDe(p);
          const contenances = p.sizes ?? [];
          return (
            <article
              key={p.id}
              className="flex flex-col gap-[7px] rounded-[22px] bg-[var(--theme-surface,#fff)] p-[8px] pb-[10px] shadow-[0_8px_20px_rgba(140,60,80,0.08)] transition-opacity duration-300"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <button
                type="button"
                onClick={() => etat.ouvrir(p.id)}
                aria-label={p.name}
                className="relative h-[140px] w-full overflow-hidden rounded-[18px]"
                style={{ background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- visuel de catalogue
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-x-2 top-[40%] text-center text-[1rem] font-black text-white">
                    {p.name.split(/\s+/)[0]}
                  </span>
                )}
                {besoin && (
                  <span className="absolute top-[8px] start-[8px] rounded-full bg-[rgba(255,255,255,.92)] px-[8px] py-[2px] text-[0.625rem] font-bold text-[var(--theme-accent-fort)]">
                    {besoin}
                  </span>
                )}
              </button>
              <div className="flex flex-col gap-[3px] px-1">
                {p.attributs?.marque && (
                  <span className="text-[0.625rem] font-bold tracking-[0.06em] text-[var(--theme-muted)] uppercase">
                    {p.attributs.marque}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => etat.ouvrir(p.id)}
                  className="line-clamp-2 text-start text-[0.8125rem] leading-[1.3] font-bold"
                >
                  {p.name}
                </button>
                <Teintes p={p} />
                {p.attributs?.peau && <span className="text-[0.6875rem] text-[var(--theme-muted)]">{p.attributs.peau}</span>}
                {contenances.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contenances.map((c) => {
                      const on = contenance[p.id] === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setContenance((cur) => ({ ...cur, [p.id]: on ? "" : c }))}
                          className="min-h-[28px] rounded-[9px] px-2 text-[0.6875rem] font-bold"
                          style={{
                            background: on ? "var(--theme-accent)" : "transparent",
                            color: on ? "var(--theme-accent-texte)" : "var(--theme-texte)",
                            border: `1px solid ${on ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
                          }}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-1 px-1">
                <span className="flex flex-col leading-[1.1]">
                  <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">{formatPrice(p.price, locale)}</span>
                  {p.compare_at_price && p.compare_at_price > p.price && (
                    <span className="text-[0.625rem] text-[var(--theme-muted)] line-through">{formatPrice(p.compare_at_price, locale)}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => ajouter(p)}
                  disabled={panier.pending || p.stock <= 0}
                  aria-label={ar ? "أضف إلى السلة" : "Ajouter au panier"}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--theme-accent)] text-[1.125rem] font-bold text-[var(--theme-accent-texte)] disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        tailleRequise
        sousTitre={etat.ouvert ? [etat.ouvert.attributs?.marque, besoinDe(etat.ouvert)].filter(Boolean).join(" · ") || null : null}
        onAjouter={(taille) => etat.ouvert && ajouter(etat.ouvert, taille)}
      >
        {etat.ouvert && (
          <>
            {(etat.ouvert.colors ?? []).length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[0.8125rem] font-extrabold">{ar ? "الألوان" : "Teintes"}</span>
                <Teintes p={etat.ouvert} grandes />
              </div>
            )}
            {etat.ouvert.attributs?.peau && (
              <p className="text-[0.8125rem]">
                <b>{ar ? "نوع البشرة : " : "Type de peau : "}</b>
                {etat.ouvert.attributs.peau}
              </p>
            )}
            {etat.ouvert.attributs?.ingredients && (
              <p className="text-[0.8125rem] leading-[1.5]">
                <b>{ar ? "المكوّنات : " : "Ingrédients : "}</b>
                {etat.ouvert.attributs.ingredients}
              </p>
            )}
          </>
        )}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
