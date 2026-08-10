import "server-only";

import { cookies } from "next/headers";
import type { AppLocale } from "@/types/database";
import { DEFAULT_LOCALE, dirFor, getDictionary, isLocale } from "./dictionaries";

export const LOCALE_COOKIE = "meg-locale";
export const TEXT_SCALE_COOKIE = "meg-text-scale";
export const SIMPLIFIED_COOKIE = "meg-simplified";

export type TextScale = "normal" | "large" | "xlarge";

/** Préférences d'affichage, lues côté serveur pour éviter tout flash. */
export interface Preferences {
  locale: AppLocale;
  dir: "ltr" | "rtl";
  textScale: TextScale;
  simplified: boolean;
}

export async function getPreferences(): Promise<Preferences> {
  const store = await cookies();

  const rawLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const rawScale = store.get(TEXT_SCALE_COOKIE)?.value;
  const textScale: TextScale =
    rawScale === "large" || rawScale === "xlarge" ? rawScale : "normal";

  return {
    locale,
    dir: dirFor(locale),
    textScale,
    simplified: store.get(SIMPLIFIED_COOKIE)?.value === "true",
  };
}

/** Dictionnaire de la requête courante. */
export async function getT() {
  const { locale } = await getPreferences();
  return { t: getDictionary(locale), locale };
}
