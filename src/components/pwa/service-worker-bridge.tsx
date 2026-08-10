"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

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

/** Événement non standard, absent de lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "meg-install-dismissed";

function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Ne pas insister : une fois refusée, l'invitation ne revient pas avant
    // trente jours.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - dismissedAt < 30 * 86_400_000) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setDeferred(null));

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
  }

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] p-3">
      <div className="animate-slide-up flex items-center gap-3 rounded-[18px] bg-[image:var(--gradient-brand)] p-3 text-white shadow-[0_10px_30px_rgba(60,40,90,0.28)]">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold">
            {t.brand.first} {t.brand.second}
          </p>
          <p className="text-[10.5px] opacity-85">
            Installez l&apos;application pour un accès hors ligne et plus rapide.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const event = deferred;
            setDeferred(null);
            await event.prompt();
            const { outcome } = await event.userChoice;
            if (outcome === "dismissed") localStorage.setItem(DISMISS_KEY, String(Date.now()));
          }}
          className="flex-none rounded-[13px] bg-white px-3 py-[7px] text-[10.5px] font-bold text-[var(--color-ink)]"
        >
          Installer
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
