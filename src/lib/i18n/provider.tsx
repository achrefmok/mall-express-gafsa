"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import type { AppLocale } from "@/types/database";
import type { Dictionary } from "./dictionaries";
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

/**
 * Le dictionnaire vient du serveur, il n'est plus embarqué.
 *
 * Ce composant importait `getDictionary`, donc le module qui exporte les deux
 * langues : quarante-huit kilo-octets de français *et* d'arabe dans le paquet
 * JavaScript de chaque visiteur, dont la moitié ne lui servirait jamais.
 *
 * La coque racine lit déjà la langue en cookie et connaît le dictionnaire : elle
 * le passe. Le changement de langue demande alors un aller-retour serveur —
 * `refresh()` — au lieu d'une bascule immédiate. C'est le bon échange : on
 * change de langue une fois dans la vie de l'application, et l'on charge chaque
 * page toute la journée. La direction du texte et l'attribut `lang`, eux,
 * s'appliquent tout de suite : c'est ce qui se voit.
 */
export function I18nProvider({
  initial,
  dictionary,
  children,
}: {
  initial: Preferences;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * Les préférences sont appliquées au DOM tout de suite — un changement de
   * taille de texte doit être instantané — puis persistées en cookie pour que
   * le rendu serveur suivant parte déjà dans le bon état.
   */
  const apply = useCallback(
    (next: Preferences, reloadDictionary = false) => {
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

        // Seule la langue exige un nouveau rendu serveur : c'est de là que
        // vient désormais le dictionnaire.
        if (reloadDictionary) router.refresh();
      });
    },
    [router],
  );

  const value = useMemo<I18nValue>(
    () => ({
      ...prefs,
      t: dictionary,
      pending,
      setLocale: (locale) =>
        apply({ ...prefs, locale, dir: locale === "ar" ? "rtl" : "ltr" }, true),
      cycleTextScale: () => {
        const next = SCALE_CYCLE[(SCALE_CYCLE.indexOf(prefs.textScale) + 1) % SCALE_CYCLE.length];
        apply({ ...prefs, textScale: next });
      },
      toggleSimplified: () => apply({ ...prefs, simplified: !prefs.simplified }),
    }),
    [prefs, dictionary, pending, apply],
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

/**
 * Variante tolérante : rend `null` hors du fournisseur au lieu de lever.
 *
 * Réservée aux écrans qui doivent s'afficher quoi qu'il arrive — la page
 * d'erreur au premier chef. Celle-ci appelait `useI18n()`, qui lève quand le
 * fournisseur manque ; or ce fournisseur vit dans la coque racine, c'est-à-dire
 * exactement ce qui peut être en train d'échouer. La page d'erreur plantait
 * alors à son tour et le visiteur recevait l'écran brut de Next.
 *
 * Partout ailleurs, `useI18n()` reste le bon choix : l'exception y signale une
 * vraie faute d'arborescence, et la masquer la rendrait indétectable.
 */
export function useI18nOptional() {
  return useContext(I18nContext);
}
