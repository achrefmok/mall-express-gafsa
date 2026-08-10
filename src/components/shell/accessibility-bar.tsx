"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";

/**
 * Barre d'accessibilité de l'accueil : « A Texte plus grand » · « العربية »
 * · « Mode simplifié ». Les trois réglages agissent immédiatement sur le
 * document et sont persistés (cookie + profil).
 */
export function AccessibilityBar() {
  const { t, textScale, locale, simplified, cycleTextScale, setLocale, toggleSimplified } = useI18n();

  const chip = "flex-none whitespace-nowrap rounded-[14px] px-3 py-[6px] text-[10.5px] font-bold";
  const on = "bg-[var(--color-brand)] text-white";
  const off = "bg-[var(--color-brand-tint)] text-[var(--color-brand)]";

  return (
    <div className="no-sb flex flex-none gap-2 overflow-x-auto px-4">
      <button
        type="button"
        onClick={cycleTextScale}
        aria-pressed={textScale !== "normal"}
        className={cx(chip, "flex items-center gap-[6px]", textScale !== "normal" ? on : off)}
      >
        <span aria-hidden className="text-[13px] leading-none">
          A
        </span>
        {t.a11y.biggerText}
      </button>

      <button
        type="button"
        onClick={() => setLocale(locale === "ar" ? "fr" : "ar")}
        lang={locale === "ar" ? "fr" : "ar"}
        className={cx(chip, off)}
      >
        {locale === "ar" ? t.a11y.french : t.a11y.arabic}
      </button>

      <button
        type="button"
        onClick={toggleSimplified}
        aria-pressed={simplified}
        className={cx(chip, simplified ? on : off)}
      >
        {t.a11y.simplified}
      </button>
    </div>
  );
}
