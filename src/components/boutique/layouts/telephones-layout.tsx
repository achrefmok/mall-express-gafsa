"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { Comparateur, nombreDe, useComparaison, type LigneComparaison } from "./comparateur";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";
import { Visionneuse3D } from "../visionneuse-3d";

/** Les quatre cases de la fiche (handoff) — clés `product_attributes`. */
const SPECS = [
  { cle: "ram", fr: "RAM", ar: "RAM" },
  { cle: "ecran", fr: "Écran", ar: "الشاشة" },
  { cle: "batterie", fr: "mAh", ar: "mAh" },
  { cle: "camera", fr: "Caméra", ar: "الكاميرا" },
] as const;

const LIGNES: LigneComparaison[] = [
  { fr: "Prix", ar: "السعر", valeur: (p) => String(p.price), nombre: (p) => p.price, meilleur: "min" },
  { fr: "RAM", ar: "RAM", valeur: (p) => p.attributs?.ram ?? null, nombre: (p) => nombreDe(p.attributs?.ram), meilleur: "max" },
  { fr: "Stockage", ar: "التخزين", valeur: (p) => p.attributs?.stockage ?? null, nombre: (p) => nombreDe(p.attributs?.stockage), meilleur: "max" },
  { fr: "Batterie", ar: "البطارية", valeur: (p) => p.attributs?.batterie ?? null, nombre: (p) => nombreDe(p.attributs?.batterie), meilleur: "max" },
  { fr: "Caméra", ar: "الكاميرا", valeur: (p) => p.attributs?.camera ?? null, nombre: (p) => nombreDe(p.attributs?.camera), meilleur: "max" },
  { fr: "Écran", ar: "الشاشة", valeur: (p) => p.attributs?.ecran ?? null, nombre: (p) => nombreDe(p.attributs?.ecran), meilleur: "max" },
  { fr: "Garantie", ar: "الضمان", valeur: (p) => (p.attributs?.garantie_mois ? `${p.attributs.garantie_mois} m` : null), nombre: (p) => nombreDe(p.attributs?.garantie_mois), meilleur: "max" },
];

/**
 * Les paliers de stockage d'un produit : ses vraies déclinaisons
 * (`products.sizes`, « 128 Go »…) — le choix part avec la ligne de panier.
 * Sans déclinaison, la valeur unique de l'attribut `stockage` s'affiche
 * comme une info. Jamais de « +400 DT par palier » : aucune déclinaison
 * n'a de prix propre dans ce schéma.
 */
const stockagesDe = (p: ProduitBoutique) => p.sizes ?? [];

/**
 * Téléphones — handoff « 02-telephones » : socle de verre néon, filtre
 * « ماركتي », liste de fiches techniques, comparateur 2–3 produits.
 */
export function TelephonesLayout({
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
  const cmp = useComparaison();
  const [stockage, setStockage] = useState<Record<string, string>>({});

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const noteDe = (p: ProduitBoutique) =>
    [p.attributs?.stockage, p.attributs?.ram].filter(Boolean).join(" · ") || p.attributs?.marque || null;

  function ajouter(p: ProduitBoutique, taille: string | null = null) {
    const choix = taille ?? stockage[p.id] ?? null;
    if (stockagesDe(p).length > 0 && !choix) {
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
        noteDe={noteDe}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "الهواتف والإكسسوارات" : "Téléphones et accessoires"} · {visible.length}
      </span>

      <div className="flex flex-col gap-[10px]">
        {visible.map((p) => {
          const specs = SPECS.map((s) => ({ ...s, v: p.attributs?.[s.cle] })).filter((s) => s.v);
          const paliers = stockagesDe(p);
          const compare = cmp.ids.includes(p.id);
          return (
            <article
              key={p.id}
              className="flex flex-col gap-[10px] rounded-[20px] bg-[var(--theme-surface,#fff)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)] transition-opacity duration-300"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => etat.ouvrir(p.id)}
                  aria-label={p.name}
                  className="relative h-[100px] w-[72px] flex-none overflow-hidden rounded-[16px] shadow-[inset_0_0_0_3px_#0b0d12]"
                  style={{ background: p.images[0] ? "#0b0d12" : fondSansPhoto(p) }}
                >
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette 72×100
                    <img src={p.images[0]} alt="" loading="lazy" className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-[13px] object-cover" />
                  ) : (
                    <span dir="ltr" className="absolute inset-x-1 top-3 text-center text-[0.875rem] leading-none font-black text-white">
                      {p.name.split(/\s+/).slice(-1)[0]}
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  {p.attributs?.marque && (
                    <span className="text-[0.625rem] font-bold tracking-[0.06em] text-[var(--theme-muted)] uppercase">
                      {p.attributs.marque}
                    </span>
                  )}
                  <button type="button" onClick={() => etat.ouvrir(p.id)} className="text-start text-[0.9375rem] leading-[1.25] font-extrabold">
                    {p.name}
                  </button>
                  <span className="flex items-baseline gap-[6px]">
                    <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">{formatPrice(p.price, locale)}</span>
                    {p.compare_at_price && p.compare_at_price > p.price && (
                      <span className="text-[0.6875rem] text-[var(--theme-muted)] line-through">
                        {formatPrice(p.compare_at_price, locale)}
                      </span>
                    )}
                  </span>
                  {p.attributs?.garantie_mois && (
                    <span className="text-[0.6875rem] text-[var(--theme-muted)]">
                      {ar ? `ضمان ${p.attributs.garantie_mois} شهر` : `Garantie ${p.attributs.garantie_mois} mois`}
                    </span>
                  )}
                  {paliers.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-[6px]">
                      {paliers.map((s) => {
                        const on = stockage[p.id] === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setStockage((cur) => ({ ...cur, [p.id]: on ? "" : s }))}
                            className="min-h-[32px] rounded-[9px] px-[10px] text-[0.75rem] font-bold"
                            style={{
                              background: on ? "var(--theme-accent)" : "transparent",
                              color: on ? "var(--theme-accent-texte)" : "var(--theme-texte)",
                              border: `1px solid ${on ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
                            }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    p.attributs?.stockage && (
                      <span className="text-[0.6875rem] font-semibold text-[var(--theme-muted)]">{p.attributs.stockage}</span>
                    )
                  )}
                </div>
              </div>

              {specs.length > 0 && (
                <div
                  className="grid gap-1 rounded-[12px] bg-[var(--theme-accent-doux)] p-2 text-center"
                  style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0,1fr))` }}
                >
                  {specs.map((s) => (
                    <span key={s.cle} className="flex min-w-0 flex-col">
                      <b className="truncate text-[0.8125rem] text-[var(--theme-accent-fort)]">{s.v}</b>
                      <span className="text-[0.625rem] text-[var(--theme-muted)]">{ar ? s.ar : s.fr}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cmp.basculer(p.id)}
                  aria-pressed={compare}
                  disabled={!compare && cmp.ids.length >= 3}
                  className="min-h-[40px] flex-none rounded-[12px] px-3 text-[0.8125rem] font-bold disabled:opacity-40"
                  style={{
                    background: compare ? "var(--theme-accent-doux)" : "transparent",
                    color: "var(--theme-accent-fort)",
                    border: "1.5px solid var(--theme-accent)",
                  }}
                >
                  {compare ? "✓ " : "+ "}
                  {ar ? "قارن" : "Comparer"}
                </button>
                <button
                  type="button"
                  onClick={() => ajouter(p)}
                  disabled={panier.pending || p.stock <= 0}
                  className="min-h-[40px] flex-1 rounded-[12px] bg-[var(--theme-accent)] px-3 text-[0.8125rem] font-extrabold text-[var(--theme-accent-texte)] disabled:opacity-50"
                >
                  {p.stock <= 0 ? (ar ? "نفد المخزون" : "Rupture") : ar ? "أضف للسلة" : "Ajouter au panier"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Comparateur
        produits={visible.filter((p) => cmp.ids.includes(p.id))}
        lignes={LIGNES.map((l) =>
          l.fr === "Prix" ? { ...l, valeur: (p: ProduitBoutique) => formatPrice(p.price, locale) } : l,
        )}
        ouvert={cmp.ouvert}
        setOuvert={cmp.setOuvert}
        locale={locale}
      />

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        tailleRequise
        sousTitre={etat.ouvert?.attributs?.marque}
        // Le produit en grand, en volume, qu'on fait tourner du doigt.
        visuel={etat.ouvert && <Visionneuse3D produit={etat.ouvert} locale={locale} />}
        onAjouter={(taille) => etat.ouvert && ajouter(etat.ouvert, taille)}
      >
        {etat.ouvert && (
          <FicheTechnique p={etat.ouvert} locale={locale} />
        )}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}

/** Le bloc « fiche technique » de la feuille : seulement les lignes renseignées. */
function FicheTechnique({ p, locale }: { p: ProduitBoutique; locale: AppLocale }) {
  const lignes = LIGNES.filter((l) => l.fr !== "Prix" && l.valeur(p));
  if (lignes.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {lignes.map((l) => (
        <div key={l.fr} className="flex flex-col rounded-[12px] bg-[var(--theme-accent-doux)] px-3 py-2">
          <dt className="text-[0.6875rem] text-[var(--theme-muted)]">{locale === "ar" ? l.ar : l.fr}</dt>
          <dd className="text-[0.875rem] font-extrabold text-[var(--theme-accent-fort)]">{l.valeur(p)}</dd>
        </div>
      ))}
    </dl>
  );
}
