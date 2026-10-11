"use client";

import { useState } from "react";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

export interface LigneComparaison {
  fr: string;
  ar: string;
  valeur: (p: ProduitBoutique) => string | null;
  /** Valeur numérique pour désigner la meilleure ; `null` = pas comparable. */
  nombre?: (p: ProduitBoutique) => number | null;
  meilleur?: "min" | "max";
}

/** Le premier nombre d'un texte libre (« 8 Go », « 5000 mAh », « 6,1″ »). */
export function nombreDe(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const m = texte.replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Ajout / retrait d'un produit à comparer — trois au plus (handoff). */
export function useComparaison() {
  const [ids, setIds] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const basculer = (id: string) =>
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));
  return { ids, basculer, ouvert, setOuvert, vider: () => setIds([]) };
}

/**
 * Le comparateur du handoff (Téléphones, Électroménager) : bouton flottant
 * « قارن (n) » dès deux produits, puis une feuille avec un tableau —
 * colonne de libellés de 72px, une colonne par produit, meilleure valeur
 * sur fond vert. Une ligne qu'aucun produit ne renseigne n'apparaît pas :
 * jamais une rangée de tirets.
 */
export function Comparateur({
  produits,
  lignes,
  ouvert,
  setOuvert,
  locale,
}: {
  produits: ProduitBoutique[];
  lignes: LigneComparaison[];
  ouvert: boolean;
  setOuvert: (v: boolean) => void;
  locale: AppLocale;
}) {
  const ar = locale === "ar";
  if (produits.length < 2) return null;

  const visibles = lignes.filter((l) => produits.some((p) => l.valeur(p)));

  return (
    <>
      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="press fixed end-4 bottom-[84px] z-30 min-h-[46px] rounded-full bg-[var(--theme-accent)] px-5 text-[0.875rem] font-extrabold text-[var(--theme-accent-texte)] shadow-[0_10px_26px_rgba(20,14,26,.3)]"
        >
          {ar ? "قارن" : "Comparer"} ({produits.length})
        </button>
      )}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={ar ? "إغلاق" : "Fermer"}
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-[rgba(20,14,26,.45)]"
          />
          <div className="relative mx-auto flex max-h-[85dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-[var(--theme-surface,#fff)] p-4 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <span className="text-[1rem] font-extrabold">{ar ? "المقارنة" : "Comparaison"}</span>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--theme-accent-doux)] font-bold text-[var(--theme-accent-fort)]"
              >
                ✕
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.75rem]">
                <thead>
                  <tr>
                    <th className="w-[72px]" />
                    {produits.map((p) => (
                      <th key={p.id} className="px-1 pb-2 text-start align-bottom text-[0.75rem] leading-[1.3] font-extrabold">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((l) => {
                    const nombres = produits.map((p) => l.nombre?.(p) ?? null);
                    const definis = nombres.filter((n): n is number => n !== null);
                    const cible =
                      l.meilleur && definis.length >= 2
                        ? l.meilleur === "min"
                          ? Math.min(...definis)
                          : Math.max(...definis)
                        : null;
                    return (
                      <tr key={l.fr} className="border-t border-[rgba(60,40,90,.08)]">
                        <td className="py-2 pe-2 text-[0.6875rem] text-[var(--theme-muted)]">{ar ? l.ar : l.fr}</td>
                        {produits.map((p, i) => {
                          const gagne = cible !== null && nombres[i] === cible;
                          return (
                            <td
                              key={p.id}
                              className="px-1 py-2"
                              style={
                                gagne
                                  ? { background: "#e2f5ea", color: "#1d6b42", fontWeight: 900, borderRadius: 8 }
                                  : undefined
                              }
                            >
                              {l.valeur(p) ?? (ar ? "غير محدد" : "n.c.")}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
