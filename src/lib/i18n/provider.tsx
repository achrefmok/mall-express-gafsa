"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import type { AppLocale } from "@/types/database";
import { getDictionary, type Dictionary } from "./dictionaries";
import type { Preferences, TextScale } from "./server";
import { savePreferences } from "@/app/actions/preferences";

interface I18nValue extends Preferences {
  t: Dictionary;
  setLocale: (locale: AppLocale) => void;
  cycleTextScale: () => void;
  toggleSimplified: () => void;
  pending: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

const SCALE_CYCLE: TextScale[] = ["normal", "large", "xlarge"];

export function I18nProvider({
  initial,
  children,
}: {
  initial: Preferences;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [pending, startTransition] = useTransition();

  /**
   * Les préférences sont appliquées au DOM tout de suite — un changement de
   * langue ou de taille de texte doit être instantané — puis persistées en
   * cookie pour que le rendu serveur suivant parte déjà dans le bon état.
   */
  const apply = useCallback((next: Preferences) => {
    setPrefs(next);

    const root = document.documentElement;
    root.lang = next.locale;
    root.dir = next.dir;
    root.dataset.textScale = next.textScale;
    root.dataset.simplified = String(next.simplified);

    startTransition(async () => {
      await savePreferences({
        locale: next.locale,
        textScale: next.textScale,
        simplified: next.simplified,
      });
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      ...prefs,
      t: getDictionary(prefs.locale),
      pending,
      setLocale: (locale) =>
        apply({ ...prefs, locale, dir: locale === "ar" ? "rtl" : "ltr" }),
      cycleTextScale: () => {
        const next = SCALE_CYCLE[(SCALE_CYCLE.indexOf(prefs.textScale) + 1) % SCALE_CYCLE.length];
        apply({ ...prefs, textScale: next });
      },
      toggleSimplified: () => apply({ ...prefs, simplified: !prefs.simplified }),
    }),
    [prefs, pending, apply],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n doit être utilisé sous <I18nProvider>");
  }
  return ctx;
}
