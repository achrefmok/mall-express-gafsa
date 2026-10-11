"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

const FORME_ORGANIQUE = "42% 58% 46% 54% / 40% 40% 60% 60%";

/**
 * Animalerie — handoff « 08-animalerie » : manège à pois, filtre
 * « حيواني » (attribut `animal`, ou la sous-catégorie animaux-chats…),
 * cartes arrondies à vignette organique.
 *
 * Les sacs (4 / 10 / 20 kg) sont les vraies déclinaisons du produit
 * (`products.sizes`), au même prix : ni la remise de palier ni
 * l'abonnement mensuel du prototype n'existent dans la boutique.
 */
export function AnimalerieLayout({
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
  const [sac, setSac] = useState<Record<string, string>>({});

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const noteDe = (p: ProduitBoutique) =>
    p.attributs?.note ?? (p.category?.slug?.startsWith("animaux-") ? (ar ? p.category.name_ar : p.category.name_fr) ?? null : null);

  function ajouter(p: ProduitBoutique, taille: string | null = null) {
    const choix = taille ?? (sac[p.id] || null);
    if ((p.sizes ?? []).length > 0 && !choix) {
      etat.ouvrir(p.id);
      return;
    }
    panier.ajouter([{ productId: p.id, size: choix }], etat.fermer);
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine vitrine={vitrine} produits={visible} etat={etat} nomBoutique={nomBoutique} locale={locale} noteDe={noteDe} />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "كل ما يحتاجه حيوانك" : "Tout pour votre animal"} · {visible.length}
      </span>

      <div className="flex flex-col gap-[10px]">
        {visible.map((p) => {
          const sacs = p.sizes ?? [];
          const note = noteDe(p);
          return (
            <article
              key={p.id}
              className="flex flex-col gap-[10px] rounded-[26px] bg-[var(--theme-surface,#fff)] p-[14px] shadow-[0_8px_20px_rgba(120,80,0,0.08)] transition-opacity duration-300"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => etat.ouvrir(p.id)}
                  aria-label={p.name}
                  className="relative h-[70px] w-[70px] flex-none overflow-hidden shadow-[0_0_0_3px_#fff,0_6px_14px_rgba(120,80,0,.18)]"
                  style={{ borderRadius: FORME_ORGANIQUE, background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}
                >
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette organique 70px
                    <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[0.75rem] font-black text-white">{p.name.split(/\s+/)[0]}</span>
                  )}
                </button>
                <button type="button" onClick={() => etat.ouvrir(p.id)} className="flex min-w-0 flex-1 flex-col items-start gap-[2px] text-start">
                  <span className="text-[0.9375rem] leading-[1.3] font-extrabold">{p.name}</span>
                  {note && <span className="text-[0.75rem] text-[var(--theme-muted)]">{note}</span>}
                  <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">{formatPrice(p.price, locale)}</span>
                </button>
              </div>

              {sacs.length > 0 && (
                <div className="flex gap-[6px]">
                  {sacs.map((s) => {
                    const on = sac[p.id] === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSac((cur) => ({ ...cur, [p.id]: on ? "" : s }))}
                        className="min-h-[36px] flex-1 rounded-[14px] text-[0.8125rem] font-bold"
                        style={{
                          background: on ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                          color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => ajouter(p)}
                disabled={panier.pending || p.stock <= 0}
                className="min-h-[44px] rounded-[16px] bg-[var(--theme-accent)] text-[0.875rem] font-extrabold text-[var(--theme-accent-texte)] disabled:opacity-50"
              >
                {p.stock <= 0 ? (ar ? "نفد المخزون" : "Rupture") : ar ? "أضف للسلة" : "Ajouter au panier"}
              </button>
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
        sousTitre={etat.ouvert ? noteDe(etat.ouvert) : null}
        onAjouter={(taille) => etat.ouvert && ajouter(etat.ouvert, taille)}
      />
      <ToastBoutique message={panier.message} />
    </div>
  );
}
