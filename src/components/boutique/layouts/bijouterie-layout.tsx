"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/**
 * « Écrin » — Bijouterie.
 *
 * Le sélecteur de matière vient des matières réellement déclarées en
 * variante (`product_variants.material`) — aucune boutique n'en a encore,
 * donc pas de sélecteur, grille classique avec poids/collection en légende
 * si renseignés.
 *
 * Taille de bague et gravure sont de purs outils d'affichage : rien n'est
 * sauvegardé (décision explicite — un client qui veut une gravure précise
 * contacte le bijoutier par la messagerie existante, comme toute
 * personnalisation aujourd'hui). Toujours visibles, puisqu'ils ne
 * dépendent d'aucune donnée produit.
 */
export function BijouterieLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const matieres = useMemo(() => {
    const set = new Set<string>();
    for (const p of visible) for (const m of p.materiaux ?? []) set.add(m);
    return [...set];
  }, [visible]);

  const [matiereActive, setMatiereActive] = useState<string | null>(null);
  const [taille, setTaille] = useState(54);
  const [gravure, setGravure] = useState("");

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const produits = matiereActive ? visible.filter((p) => p.materiaux?.includes(matiereActive)) : visible;
  const diametreMm = (taille / Math.PI).toFixed(1);
  const diametrePx = Math.round(taille / Math.PI) * 3.2;

  // Le cours du jour est optionnel, saisi par le vendeur sur n'importe quel
  // produit de la matière active — on prend le premier trouvé plutôt que
  // d'inventer un taux par défaut.
  const tauxJour = matiereActive
    ? produits.map((p) => p.attributs?.taux_jour).find(Boolean)
    : undefined;

  return (
    <div className="flex flex-col gap-[14px]">
      {matieres.length > 0 && (
        <div className="flex gap-[4px] rounded-[18px] bg-[var(--theme-accent-doux)] p-[4px]">
          {matieres.map((m) => {
            const on = m === matiereActive;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMatiereActive(on ? null : m)}
                className="flex-1 rounded-[14px] py-[8px] text-center text-[0.71875rem] font-bold whitespace-nowrap"
                style={{
                  background: on ? "var(--theme-accent)" : "transparent",
                  color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      {tauxJour && (
        <div className="flex items-center justify-between rounded-[16px] bg-[var(--theme-surface)] px-[13px] py-[10px] shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
          <span className="text-[0.6875rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "سعر اليوم" : "Cours du jour"}
          </span>
          <span className="text-[0.875rem] font-bold" style={{ color: "var(--theme-accent-fort)" }}>
            {tauxJour}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {produits.map((p) => {
          const legende = [p.attributs?.poids_g && `${p.attributs.poids_g} g`, p.attributs?.collection]
            .filter(Boolean)
            .join(" · ");
          return (
            <div key={p.id} className="flex flex-col gap-[2px]">
              <ProductCard product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
              {legende && (
                <p className="px-[4px] text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">{legende}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-[10px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
        <span className="text-[0.6875rem] font-bold">{locale === "ar" ? "مقاس الخاتم" : "Ma taille de bague"}</span>
        <div className="flex items-center gap-[14px]">
          <span
            className="flex-none rounded-full border-[3px] border-[var(--theme-accent)] bg-[var(--theme-accent-doux)]"
            style={{ width: diametrePx, height: diametrePx }}
          />
          <div className="flex flex-1 flex-col gap-[6px]">
            <input
              type="range"
              min={44}
              max={68}
              value={taille}
              onChange={(e) => setTaille(Number(e.target.value))}
              style={{ accentColor: "var(--theme-accent)" }}
            />
            <span className="text-[0.75rem]">
              {locale === "ar" ? "مقاس" : "Taille"} <b>{taille}</b> · Ø {diametreMm} mm
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[8px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
        <span className="text-[0.6875rem] font-bold">{locale === "ar" ? "نقش مخصص" : "Gravure personnalisée"}</span>
        <input
          value={gravure}
          onChange={(e) => setGravure(e.target.value.slice(0, 18))}
          placeholder={locale === "ar" ? "اسم، تاريخ…" : "Prénom, date…"}
          className="rounded-[14px] border border-[var(--theme-bordure)] bg-[var(--color-surface-solid)] px-[12px] py-[10px] text-[0.75rem] text-[var(--theme-texte)] outline-none"
        />
        <div
          className="min-h-[28px] rounded-[14px] bg-[var(--theme-accent-doux)] px-[14px] py-[16px] text-[1.25rem] font-medium tracking-[0.04em] italic"
          style={{ color: "var(--theme-accent-fort)" }}
        >
          {gravure || (locale === "ar" ? "اسم و تاريخ · 2026" : "Prénom & date · 2026")}
        </div>
        <p className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
          {locale === "ar"
            ? "معاينة فقط — تواصلوا مع الصائغ لتأكيد النقش."
            : "Aperçu seulement — contactez le bijoutier pour confirmer la gravure."}
        </p>
      </div>
    </div>
  );
}
