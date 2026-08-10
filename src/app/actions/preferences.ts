"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n/dictionaries";
import {
  LOCALE_COOKIE,
  SIMPLIFIED_COOKIE,
  TEXT_SCALE_COOKIE,
  type TextScale,
} from "@/lib/i18n/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

const SCALE_VALUE: Record<TextScale, number> = {
  normal: 1.0,
  large: 1.15,
  xlarge: 1.3,
};

/**
 * Persiste langue, échelle typographique et mode simplifié.
 * Cookie pour tout le monde (visiteurs compris) ; profil en plus si connecté,
 * pour retrouver ses réglages sur un autre appareil.
 */
export async function savePreferences(input: {
  locale: string;
  textScale: TextScale;
  simplified: boolean;
}) {
  const locale = isLocale(input.locale) ? input.locale : "fr";
  const textScale: TextScale =
    input.textScale === "large" || input.textScale === "xlarge" ? input.textScale : "normal";
  const simplified = Boolean(input.simplified);

  const store = await cookies();
  const options = {
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  store.set(LOCALE_COOKIE, locale, options);
  store.set(TEXT_SCALE_COOKIE, textScale, options);
  store.set(SIMPLIFIED_COOKIE, String(simplified), options);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from("profiles")
      .update({
        locale,
        text_scale: SCALE_VALUE[textScale],
        simplified_mode: simplified,
      })
      .eq("id", user.id);
  }

  return { ok: true as const };
}
