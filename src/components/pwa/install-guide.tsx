"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useInstallPrompt } from "./use-install-prompt";

/**
 * Le bouton d'installation, et le chemin à suivre quand un bouton ne suffit pas.
 *
 * Trois situations, que le navigateur ne laisse pas distinguer autrement :
 *   · Android avec Chrome ou Edge : un appui, le système prend la suite ;
 *   · Android sans invite (Samsung Internet, Firefox…) : le menu ⋮, en trois pas ;
 *   · iPhone : Safari n'expose aucune API — Apple réserve le geste à son menu de
 *     partage. On le décrit, et l'on prévient que Chrome ou un navigateur
 *     intégré (Facebook, Instagram) ne peuvent pas installer du tout.
 *
 * Les navigateurs intégrés sont détectés à part : un visiteur venu d'un lien
 * partagé sur Facebook cherchera l'installation dans un endroit où elle n'existe
 * pas, et aucun de nos pas ne lui servirait avant de sortir de là.
 */
export function InstallGuide({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { t } = useI18n();
  const { state, isIOS, canInstallInOneTap, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [android, setAndroid] = useState(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setAndroid(/Android/i.test(navigator.userAgent));
    setInApp(/FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger/i.test(navigator.userAgent));
  }, []);

  const dark = tone === "dark";
  const panel = dark ? "bg-white/12 text-white" : "bg-[var(--color-app)] text-[var(--color-ink)]";
  const muted = dark ? "text-white/75" : "text-[var(--color-muted)]";

  if (state.kind === "installed") {
    return (
      <p className={`rounded-[16px] p-3 text-[0.75rem] font-semibold ${panel}`}>{t.install.already}</p>
    );
  }

  function steps(title: string, list: string[]) {
    return (
      <div className={`flex flex-col gap-2 rounded-[16px] p-3 ${panel}`}>
        <p className="text-[0.75rem] font-bold">{title}</p>
        <ol className="flex flex-col gap-2">
          {list.map((step, index) => (
            <li key={step} className="flex items-start gap-2">
              <span
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[0.625rem] font-bold ${
                  dark ? "bg-white text-[var(--color-brand)]" : "bg-[var(--color-brand-fill)] text-white"
                }`}
              >
                {index + 1}
              </span>
              <span className="text-[0.71875rem] leading-[1.5]">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => (canInstallInOneTap ? void install() : setOpen((v) => !v))}
        aria-expanded={canInstallInOneTap ? undefined : open}
        className={`press w-full rounded-[16px] py-3 text-[0.8125rem] font-bold ${
          dark ? "bg-white text-[var(--color-brand)]" : "bg-[var(--color-brand-fill)] text-white"
        }`}
      >
        {t.installGuide.button}
      </button>

      {!canInstallInOneTap && open && (
        <>
          {inApp && (
            <div className={`rounded-[16px] p-3 ${panel}`}>
              <p className="text-[0.75rem] font-bold">{t.installGuide.inAppTitle}</p>
              <p className={`mt-1 text-[0.71875rem] leading-[1.5] ${muted}`}>{t.installGuide.inAppBody}</p>
            </div>
          )}

          {isIOS &&
            steps(t.installGuide.iosTitle, [t.install.iosStep1, t.install.iosStep2, t.install.iosStep3])}
          {isIOS && <p className={`px-1 text-[0.65625rem] leading-[1.5] ${muted}`}>{t.installGuide.iosNote}</p>}

          {!isIOS &&
            (android ? (
              steps(t.installGuide.androidTitle, [
                t.installGuide.androidStep1,
                t.installGuide.androidStep2,
                t.installGuide.androidStep3,
              ])
            ) : (
              <p className={`rounded-[16px] p-3 text-[0.71875rem] leading-[1.5] ${panel}`}>
                {t.install.otherHint}
              </p>
            ))}
        </>
      )}
    </div>
  );
}
