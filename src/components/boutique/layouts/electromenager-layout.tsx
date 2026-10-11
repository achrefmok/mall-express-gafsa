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

const CLASSES = ["A+++", "A++", "A+", "A", "B", "C", "D"] as const;
/** Teintes du handoff : oklch(.62 .17 145) → oklch(.62 .17 13), en sept pas. */
const TEINTES = [145, 123, 101, 79, 57, 35, 13];

/** L'indice de classe énergie déclaré (`classe_energie`), `null` si absent ou illisible. */
function indiceEnergie(p: ProduitBoutique): number | null {
  const v = p.attributs?.classe_energie?.toUpperCase().replace(/\s/g, "");
  if (!v) return null;
  const i = CLASSES.indexOf(v as (typeof CLASSES)[number]);
  return i >= 0 ? i : null;
}

function garantie(p: ProduitBoutique, ar: boolean): string | null {
  const m = nombreDe(p.attributs?.garantie_mois);
  if (m === null) return null;
  if (m % 12 === 0) return ar ? `ضمان ${m / 12} سنوات` : `Garantie ${m / 12} an${m > 12 ? "s" : ""}`;
  return ar ? `ضمان ${m} شهر` : `Garantie ${m} mois`;
}

function Etiquette({ indice }: { indice: number }) {
  return (
    <span className="flex items-end gap-[2px]" aria-label={`Classe énergie ${CLASSES[indice]}`}>
      {CLASSES.map((c, i) => (
        <span
          key={c}
          className="flex w-[22px] items-center justify-center rounded-[3px] text-[0.5625rem] font-black text-white"
          style={{
            height: i === indice ? 22 : 10,
            opacity: i === indice ? 1 : 0.45,
            background: `oklch(.62 .17 ${TEINTES[i]})`,
          }}
        >
          {i === indice ? c : ""}
        </span>
      ))}
    </span>
  );
}

/**
 * Électroménager — handoff « 05-electromenager » : showroom LED, filtre
 * « لأيّ غرفة؟ », liste d'appareils avec étiquette énergie, paiement en
 * plusieurs fois et comparateur.
 *
 * Le prix au mois n'apparaît que si la boutique a déclaré des versements
 * (`shops.installments`) : c'est un repère de budget (arrondi supérieur de
 * prix / mois), pas un paiement fractionné réel.
 */
export function ElectromenagerLayout({
  visible,
  locale,
  theme,
  vitrine,
  nomBoutique,
  installments,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  vitrine: ConfigVitrine;
  nomBoutique: string;
  installments: number[];
}) {
  const ar = locale === "ar";
  const etat = useVitrine(visible, vitrine);
  const panier = useAjoutPanier();
  const cmp = useComparaison();
  const options = [1, ...[3, 6, 12].filter((n) => installments.includes(n))];
  const [mois, setMois] = useState(1);

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const prix = (p: ProduitBoutique) =>
    mois > 1 ? `${formatPrice(Math.ceil(p.price / mois), locale)} ${ar ? "/ شهر" : "/ mois"}` : formatPrice(p.price, locale);

  const specsDe = (p: ProduitBoutique) =>
    [p.attributs?.capacite, garantie(p, ar), p.attributs?.bruit_db ? `${p.attributs.bruit_db} dB` : null].filter(Boolean).join(" · ");

  const lignes: LigneComparaison[] = [
    { fr: "Prix", ar: "السعر", valeur: (p) => formatPrice(p.price, locale), nombre: (p) => p.price, meilleur: "min" },
    { fr: "Énergie", ar: "الطاقة", valeur: (p) => p.attributs?.classe_energie ?? null, nombre: indiceEnergie, meilleur: "min" },
    { fr: "Garantie", ar: "الضمان", valeur: (p) => garantie(p, ar), nombre: (p) => nombreDe(p.attributs?.garantie_mois), meilleur: "max" },
    { fr: "Bruit", ar: "الضجيج", valeur: (p) => (p.attributs?.bruit_db ? `${p.attributs.bruit_db} dB` : null), nombre: (p) => nombreDe(p.attributs?.bruit_db), meilleur: "min" },
    { fr: "Capacité", ar: "السعة", valeur: (p) => p.attributs?.capacite ?? null },
  ];

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => specsDe(p) || null}
      />

      {options.length > 1 && (
        <div className="flex flex-col gap-2 rounded-[16px] border border-[rgba(60,40,90,.08)] bg-[var(--theme-surface,#fff)] px-[14px] py-3">
          <span className="text-[0.875rem] font-extrabold">{ar ? "طريقة الدفع" : "Paiement"}</span>
          <div className="flex gap-1 rounded-[14px] bg-[var(--theme-accent-doux)] p-1">
            {options.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={mois === n}
                onClick={() => setMois(n)}
                className="min-h-[36px] flex-1 rounded-[10px] text-[0.8125rem] font-bold"
                style={{
                  background: mois === n ? "var(--theme-surface,#fff)" : "transparent",
                  color: mois === n ? "var(--theme-accent-fort)" : "var(--theme-muted)",
                }}
              >
                {n === 1 ? (ar ? "نقدا" : "Comptant") : ar ? `${n} أشهر` : `${n} mois`}
              </button>
            ))}
          </div>
        </div>
      )}

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "الأجهزة" : "Les appareils"} · {visible.length}
      </span>

      <div className="flex flex-col gap-[10px]">
        {visible.map((p) => {
          const energie = indiceEnergie(p);
          const specs = specsDe(p);
          const compare = cmp.ids.includes(p.id);
          return (
            <article
              key={p.id}
              className="flex flex-col gap-[10px] rounded-[18px] bg-[var(--theme-surface,#fff)] p-3 shadow-[0_6px_18px_rgba(10,30,50,0.07)] transition-opacity duration-300"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => etat.ouvrir(p.id)}
                  aria-label={p.name}
                  className="relative h-[84px] w-[84px] flex-none overflow-hidden rounded-[14px]"
                  style={{ background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}
                >
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette 84px
                    <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[0.8125rem] font-black text-white">{p.name.split(/\s+/)[0]}</span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <button type="button" onClick={() => etat.ouvrir(p.id)} className="text-start text-[0.875rem] leading-[1.3] font-bold">
                    {p.name}
                  </button>
                  {specs && <span className="text-[0.6875rem] text-[var(--theme-muted)]">{specs}</span>}
                  <span className="flex flex-col">
                    <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">{prix(p)}</span>
                    {mois > 1 && (
                      <span className="text-[0.625rem] text-[var(--theme-muted)]">
                        {ar ? `${mois} أشهر · ${formatPrice(p.price, locale)}` : `${mois} mois · ${formatPrice(p.price, locale)}`}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {energie !== null && <Etiquette indice={energie} />}
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
                  onClick={() => panier.ajouter([{ productId: p.id }])}
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
        lignes={lignes}
        ouvert={cmp.ouvert}
        setOuvert={cmp.setOuvert}
        locale={locale}
      />

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        prixAffiche={etat.ouvert && mois > 1 ? prix(etat.ouvert) : undefined}
        sousTitre={etat.ouvert ? specsDe(etat.ouvert) || null : null}
        onAjouter={(taille) => etat.ouvert && panier.ajouter([{ productId: etat.ouvert.id, size: taille }], etat.fermer)}
      >
        {etat.ouvert && indiceEnergie(etat.ouvert) !== null && <Etiquette indice={indiceEnergie(etat.ouvert)!} />}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
