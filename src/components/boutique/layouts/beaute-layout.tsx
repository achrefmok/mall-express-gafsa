"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

const ONGLETS = [
  { slug: "beaute-maquillage", labelFr: "Maquillage", labelAr: "مكياج" },
  { slug: "beaute-parfums", labelFr: "Parfums", labelAr: "عطور" },
  { slug: "beaute-soin", labelFr: "Soin", labelAr: "العناية" },
] as const;

/** Six carnations de référence — le choix sert à rapprocher des teintes réelles, pas à les inventer. */
const CARNATIONS = ["#f6dcc6", "#ecc4a2", "#d9a57c", "#c08a5f", "#9a6640", "#6b4429"];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * « Studio premium » — Beauté, trois onglets internes.
 *
 * Les onglets viennent des sous-catégories `beaute-maquillage`/
 * `beaute-parfums`/`beaute-soin` (migration dédiée) — une vraie donnée que
 * le vendeur choisit en rangeant son produit. Aucune boutique n'a encore
 * rangé ses produits ainsi : la grille simple reste le repli.
 *
 * Le trouveur de teinte réutilise `products.colors` — déjà saisi par le
 * vendeur pour tout produit qui en a — et calcule la couleur la plus
 * proche de la carnation choisie, sans inventer de teinte « recommandée »
 * qui n'existerait pas réellement dans le catalogue.
 */
export function BeauteLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const { t } = useI18n();
  const [carnation, setCarnation] = useState<number | null>(null);

  const groupes = useMemo(() => {
    const parSlug = new Map<string, ProduitBoutique[]>();
    for (const o of ONGLETS) parSlug.set(o.slug, []);
    for (const p of visible) {
      const slug = p.category?.slug;
      if (slug && parSlug.has(slug)) parSlug.get(slug)!.push(p);
    }
    return parSlug;
  }, [visible]);

  const ongletsUtiles = ONGLETS.filter((o) => (groupes.get(o.slug) ?? []).length > 0);
  const [actif, setActif] = useState<string | null>(null);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  // Moins de deux onglets réellement peuplés : pas de segmentation utile.
  if (ongletsUtiles.length < 2) {
    return (
      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {visible.map((p) => (
          <ProductCard key={p.id} product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
        ))}
      </div>
    );
  }

  const slugActif = actif ?? ongletsUtiles[0].slug;
  const produitsOnglet = groupes.get(slugActif) ?? [];
  const estMaquillage = slugActif === "beaute-maquillage";
  const estParfums = slugActif === "beaute-parfums";

  const cible = carnation !== null ? hexToRgb(CARNATIONS[carnation]) : null;
  const produitsActifs =
    estMaquillage && cible
      ? [...produitsOnglet].sort((a, b) => {
          const da = Math.min(...(a.colors ?? []).map((c) => hexToRgb(c)).filter(Boolean).map((c) => distance(c!, cible)), Infinity);
          const db = Math.min(...(b.colors ?? []).map((c) => hexToRgb(c)).filter(Boolean).map((c) => distance(c!, cible)), Infinity);
          return da - db;
        })
      : produitsOnglet;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex gap-[4px] rounded-[18px] bg-[var(--theme-accent-doux)] p-[4px]">
        {ongletsUtiles.map((o) => {
          const on = o.slug === slugActif;
          return (
            <button
              key={o.slug}
              type="button"
              onClick={() => setActif(o.slug)}
              className="flex-1 rounded-[14px] py-[8px] text-center text-[0.71875rem] font-bold whitespace-nowrap"
              style={{
                background: on ? "var(--theme-surface,#fff)" : "transparent",
                color: on ? "var(--theme-accent-fort)" : "var(--theme-muted)",
              }}
            >
              {locale === "ar" ? o.labelAr : o.labelFr}
            </button>
          );
        })}
      </div>

      {estMaquillage && (
        <div className="flex flex-col gap-[10px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem] font-bold">{locale === "ar" ? "اعثر على لوني" : "Trouver ma teinte"}</span>
            <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
              {locale === "ar" ? "المسوا لون بشرتكم" : "Touchez votre carnation"}
            </span>
          </div>
          <div className="flex justify-between">
            {CARNATIONS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setCarnation(carnation === i ? null : i)}
                className="h-[36px] w-[36px] rounded-full"
                style={{
                  background: c,
                  boxShadow: carnation === i ? "0 0 0 3px var(--theme-surface,#fff), 0 0 0 5px var(--theme-accent)" : "0 2px 6px rgba(60,40,90,0.15)",
                }}
                aria-label={`Carnation ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {produitsActifs.length === 0 ? (
        <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
          {produitsActifs.map((p, i) => {
            const notes = estParfums
              ? (["note_tete", "note_coeur", "note_fond"] as const).map((c) => p.attributs?.[c]).filter(Boolean)
              : [];
            const recommande = estMaquillage && cible && i === 0 && (p.colors ?? []).length > 0;
            return (
              <div key={p.id} className="flex flex-col gap-[4px]">
                <div className="relative">
                  <ProductCard product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
                  {recommande && (
                    <span className="absolute top-[8px] left-[8px] rounded-[10px] bg-[var(--theme-accent,var(--color-brand-fill))] px-[8px] py-[3px] text-[0.5625rem] font-bold text-[var(--theme-accent-texte,white)]">
                      {locale === "ar" ? "منصوح به" : "Conseillé"}
                    </span>
                  )}
                </div>
                {p.colors && p.colors.length > 0 && (
                  <div className="flex gap-[4px] px-[4px]">
                    {p.colors.slice(0, 5).map((c) => (
                      <span key={c} className="h-[12px] w-[12px] rounded-full border border-[var(--theme-bordure)]" style={{ background: c }} />
                    ))}
                  </div>
                )}
                {estParfums && notes.length > 0 && (
                  <div className="flex flex-col gap-[3px] px-[4px]">
                    {(["Tête", "Cœur", "Fond"] as const).map((label, idx) => {
                      const valeur = notes[idx];
                      if (!valeur) return null;
                      const largeur = ["100%", "90%", "80%"][idx];
                      return (
                        <div
                          key={label}
                          className="flex items-center justify-between gap-[6px] rounded-[8px] px-[7px] py-[3px]"
                          style={{ width: largeur, background: "var(--theme-accent-doux)" }}
                        >
                          <span className="text-[0.5rem] font-bold text-[var(--theme-accent-fort)]">{label}</span>
                          <span className="truncate text-[0.5625rem]">{valeur}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {estParfums && p.attributs?.tenue_heures && (
                  <p className="px-[4px] text-[0.625rem] font-bold text-[var(--theme-accent-fort)]">
                    {t.product.wear} {p.attributs.tenue_heures}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
