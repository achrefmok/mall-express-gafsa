"use client";

import { useI18n } from "@/lib/i18n/provider";

/**
 * Le basculement FR/AR, là où l'œil est déjà.
 *
 * Le réglage existe dans la barre d'accessibilité — mais il se décide au bas de
 * l'accueil, après avoir fait défiler plusieurs sections. Un bouton dans
 * l'en-tête, à côté de la cloche et du panier, donne le réglage au premier
 * coup d'œil : on change de langue sans chercher.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "ar" ? "fr" : "ar")}
      lang={locale === "ar" ? "fr" : "ar"}
      aria-label={locale === "ar" ? "Passer en français" : "التبديل إلى العربية"}
      className="press flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[0.8125rem] font-bold text-[var(--color-ink)] shadow-[0_6px_16px_rgba(60,40,90,0.09)]"
    >
      {locale === "ar" ? "FR" : "ع"}
    </button>
  );
}
