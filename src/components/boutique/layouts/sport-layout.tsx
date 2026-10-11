"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { normaliser, type ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { nombreDe } from "./comparateur";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

const NIVEAUX = [
  { fr: "Débutant", ar: "مبتدئ", mots: ["debut", "مبتدئ"] },
  { fr: "Loisir", ar: "هاوٍ", mots: ["loisir", "occasion", "هاو"] },
  { fr: "Confirmé", ar: "متوسط", mots: ["confirm", "interm", "متوسط"] },
  { fr: "Avancé", ar: "متقدّم", mots: ["avance", "expert", "متقدم"] },
  { fr: "Élite", ar: "نخبة", mots: ["elite", "compet", "pro", "نخبة"] },
];

/** Niveau 1–5 : un chiffre saisi, ou le mot (débutant… élite). */
function niveauDe(p: ProduitBoutique): number | null {
  const brut = p.attributs?.niveau;
  if (!brut) return null;
  const n = nombreDe(brut);
  if (n !== null) return Math.max(1, Math.min(5, Math.round(n)));
  const t = normaliser(brut);
  const i = NIVEAUX.findIndex((l) => l.mots.some((m) => t.includes(m)));
  return i >= 0 ? i + 1 : null;
}

function BarreNiveau({ niveau, locale }: { niveau: number; locale: AppLocale }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-[3px]" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <i
            key={i}
            className="h-[7px] w-[14px] -skew-x-[20deg] rounded-[2px]"
            style={{ background: i <= niveau ? "var(--theme-accent)" : "color-mix(in srgb,var(--theme-accent) 16%,#fff)" }}
          />
        ))}
      </span>
      <span className="text-[0.6875rem] font-bold text-[var(--theme-muted)]">
        {locale === "ar" ? NIVEAUX[niveau - 1].ar : NIVEAUX[niveau - 1].fr}
      </span>
    </span>
  );
}

/**
 * Sport — handoff « 09-sport » : podium sous projecteurs, filtre
 * « رياضتي », grille d'équipements à image coupée en diagonale, barre de
 * niveau (attribut `niveau`), taille obligatoire avant l'ajout.
 */
export function SportLayout({
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
  const [taille, setTaille] = useState<Record<string, string>>({});

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  function ajouter(p: ProduitBoutique, choixFeuille: string | null = null) {
    const choix = choixFeuille ?? (taille[p.id] || null);
    if ((p.sizes ?? []).length > 0 && !choix) {
      panier.annoncer(ar ? "اختر المقاس أولا" : "Choisissez d'abord la taille");
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
        noteDe={(p) => p.attributs?.sport ?? null}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "المعدّات" : "L'équipement"} · {visible.length}
      </span>

      <div className="grid grid-cols-2 gap-[10px]">
        {visible.map((p) => {
          const niveau = niveauDe(p);
          const tailles = p.sizes ?? [];
          return (
            <article
              key={p.id}
              className="flex flex-col overflow-hidden rounded-[8px] bg-[var(--theme-surface,#fff)] shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition-opacity duration-300"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <button
                type="button"
                onClick={() => etat.ouvrir(p.id)}
                aria-label={p.name}
                className="relative h-[118px] w-full"
                style={{
                  clipPath: "polygon(0 0,100% 0,100% 86%,0 100%)",
                  background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p),
                }}
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- visuel 118px
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[1rem] font-black text-white uppercase italic">{p.name.split(/\s+/)[0]}</span>
                )}
              </button>
              <div className="flex flex-1 flex-col gap-[6px] p-[10px] pt-1">
                <button type="button" onClick={() => etat.ouvrir(p.id)} className="line-clamp-2 text-start text-[0.8125rem] leading-[1.3] font-bold">
                  {p.name}
                </button>
                {niveau && <BarreNiveau niveau={niveau} locale={locale} />}
                {tailles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tailles.map((s) => {
                      const on = taille[p.id] === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setTaille((cur) => ({ ...cur, [p.id]: on ? "" : s }))}
                          className="min-h-[28px] min-w-[32px] rounded-[6px] px-[6px] text-[0.6875rem] font-bold"
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
                )}
                <div className="mt-auto flex items-center justify-between gap-1">
                  <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">{formatPrice(p.price, locale)}</span>
                  <button
                    type="button"
                    onClick={() => ajouter(p)}
                    disabled={panier.pending || p.stock <= 0}
                    aria-label={ar ? "أضف إلى السلة" : "Ajouter au panier"}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-[6px] text-[1.125rem] font-black disabled:opacity-50"
                    style={{ background: vitrine.scene.encrePastille, color: vitrine.scene.pastille }}
                  >
                    +
                  </button>
                </div>
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
        sousTitre={etat.ouvert?.attributs?.sport}
        onAjouter={(choix) => etat.ouvert && ajouter(etat.ouvert, choix)}
      >
        {etat.ouvert && niveauDe(etat.ouvert) && <BarreNiveau niveau={niveauDe(etat.ouvert)!} locale={locale} />}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
