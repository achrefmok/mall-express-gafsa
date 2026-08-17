"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useInstallPrompt } from "./use-install-prompt";

/**
 * Trois responsabilités, volontairement réunies dans un seul composant monté
 * une fois dans la racine :
 *   · enregistrer le service worker ;
 *   · proposer l'installation quand le navigateur le permet ;
 *   · signaler la perte de réseau.
 */
export function ServiceWorkerBridge() {
  return (
    <>
      <ServiceWorkerRegistration />
      <InstallCapture />
      <OfflineBanner />
      <InstallPrompt />
    </>
  );
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    };

    // Attendre le chargement complet : l'enregistrement du service worker ne
    // doit pas concurrencer le premier rendu sur une connexion lente.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] bg-[var(--color-ink)] px-4 py-2 text-center text-[11px] font-semibold text-white"
    >
      {t.common.offline}
    </div>
  );
}

/*
  L'invite d'installation, captée une fois et partagée.

  `beforeinstallprompt` n'est émis qu'une fois par chargement de page, et très
  tôt. Chaque composant qui l'écoutait pour son compte risquait de le manquer —
  ou de le consommer au nez de l'autre, puisqu'une invite ne se déclenche qu'une
  seule fois. On la retient donc ici, au plus près du chargement, et on la
  dépose sur `window` pour que le panneau du profil la retrouve, même monté
  longtemps après.
*/
function InstallCapture() {
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      (window as Window & { __megInstallEvent?: Event }).__megInstallEvent = event;
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return null;
}

const DISMISS_KEY = "meg-install-dismissed";

/**
 * Le bandeau d'invitation, en bas de l'écran.
 *
 * Il ne s'affiche que là où l'installation tient en un geste — donc pas sur
 * iPhone, où aucune API ne l'autorise. Un bandeau qui ne saurait qu'expliquer un
 * détour par le menu de partage se ferait fermer sans être lu ; cette
 * explication vit dans le panneau du profil, où on la cherche.
 */
function InstallPrompt() {
  const { t } = useI18n();
  const { canInstallInOneTap, install } = useInstallPrompt();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Ne pas insister : une fois refusée, l'invitation ne revient pas avant
    // trente jours.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    setHidden(Date.now() - dismissedAt < 30 * 86_400_000);
  }, []);

  if (hidden || !canInstallInOneTap) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] p-3">
      <div className="animate-slide-up flex items-center gap-3 rounded-[18px] bg-[image:var(--gradient-brand)] p-3 text-white shadow-[0_10px_30px_rgba(60,40,90,0.28)]">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold">
            {t.brand.first} {t.brand.second}
          </p>
          <p className="text-[10.5px] opacity-85">{t.install.bannerBody}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            void install();
            dismiss();
          }}
          className="flex-none rounded-[13px] bg-white px-3 py-[7px] text-[10.5px] font-bold text-[var(--color-ink)]"
        >
          {t.install.action}
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t.common.close}
          className="flex-none p-1 text-[16px] leading-none opacity-70"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
