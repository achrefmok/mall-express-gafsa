"use client";

import type { FiltreMetier, OptionFiltre } from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";

/**
 * Le filtre du métier (handoff, structure commune §5) : « الكل » + options,
 * puces de 36px. L'option choisie éteint ce qui ne correspond pas — .25 sur
 * le présentoir, .38 dans le catalogue, à la charge de l'appelant.
 *
 * Masqué entièrement sans option : `optionsPresentes` ne garde que celles
 * qu'au moins un produit porte, jamais une puce qui éteindrait tout.
 */
export function FiltreMetierPuces({
  filtre,
  options,
  actif,
  onChange,
  locale,
}: {
  filtre: FiltreMetier;
  options: OptionFiltre[];
  actif: string | null;
  onChange: (cle: string | null) => void;
  locale: AppLocale;
}) {
  if (options.length === 0) return null;

  const puce = (cle: string | null, libelle: string) => {
    const on = cle === actif;
    return (
      <button
        key={cle ?? "*"}
        type="button"
        aria-pressed={on}
        onClick={() => onChange(on && cle !== null ? null : cle)}
        className="min-h-[36px] rounded-full px-[14px] text-[0.8125rem] font-bold whitespace-nowrap transition-colors"
        style={{
          background: on ? "var(--theme-accent)" : "var(--theme-surface,#fff)",
          color: on ? "var(--theme-accent-texte)" : "var(--theme-texte)",
          border: `1px solid ${on ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
        }}
      >
        {libelle}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-extrabold">
        {locale === "ar" ? filtre.titre.ar : filtre.titre.fr}{" "}
        <span className="font-medium text-[var(--theme-muted,var(--color-muted))]">
          · {locale === "ar" ? "يضيء الرّف ما يناسبك" : "le présentoir s'allume pour vous"}
        </span>
      </span>
      <div className="flex flex-wrap gap-[6px]">
        {puce(null, locale === "ar" ? "الكل" : "Tout")}
        {options.map((o) => puce(o.cle, locale === "ar" ? o.ar : o.fr))}
      </div>
    </div>
  );
}
