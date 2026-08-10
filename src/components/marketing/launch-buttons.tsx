"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Événement non standard, absent de lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState =
  | { kind: "ready"; event: BeforeInstallPromptEvent } // Chrome, Edge, Android
  | { kind: "installed" }
  | { kind: "manual" }; // iOS Safari : pas d'API, il faut expliquer

/**
 * Les deux façons d'entrer dans l'application, côte à côte.
 *
 * « Parcourir » est un simple lien : il fonctionne partout, tout de suite.
 * « Installer » dépend du navigateur — l'API n'existe ni sur Safari iOS ni
 * en navigation privée. Plutôt que de masquer le bouton ou de le laisser
 * sans effet, on explique le geste à faire à la main.
 */
export function LaunchButtons({ browseHref = "/accueil" }: { browseHref?: string }) {
  const [install, setInstall] = useState<InstallState>({ kind: "manual" });
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other">("other");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS : propriété propriétaire, absente du type Navigator.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setInstall({ kind: "installed" });
      return;
    }

    setPlatform(/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "other");

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstall({ kind: "ready", event: event as BeforeInstallPromptEvent });
    };
    const onInstalled = () => setInstall({ kind: "installed" });

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onInstall() {
    if (install.kind !== "ready") {
      setShowHelp(true);
      return;
    }

    const { event } = install;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setInstall({ kind: "installed" });
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:items-start">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href={browseHref}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-[var(--color-brand)] px-7 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(109,75,143,0.32)] transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
        >
          Parcourir le site
          <span aria-hidden>→</span>
        </Link>

        <button
          type="button"
          onClick={onInstall}
          disabled={install.kind === "installed"}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border border-[var(--color-outline)] bg-white/70 px-7 text-[15px] font-bold text-[var(--color-ink)] backdrop-blur-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {install.kind === "installed" ? "Application installée" : "Installer l'application"}
        </button>
      </div>

      <p className="max-w-[46ch] text-center text-[12px] leading-[1.5] text-[var(--color-muted)] sm:text-start">
        Aucun téléchargement depuis un magasin d&apos;applications : le site
        s&apos;installe directement depuis le navigateur, occupe moins de 2 Mo et
        fonctionne hors réseau.
      </p>

      {showHelp && install.kind !== "ready" && (
        <div
          role="status"
          className="max-w-[52ch] rounded-[16px] border border-[var(--color-outline)] bg-white/80 p-4 text-start"
        >
          <p className="text-[12.5px] font-bold text-[var(--color-ink)]">
            Installation à la main
          </p>
          <p className="mt-1 text-[12px] leading-[1.6] text-[var(--color-muted)]">
            {platform === "ios" ? (
              <>
                Sur iPhone, ouvrez ce site dans <b>Safari</b>, touchez le bouton
                de partage, puis <b>« Sur l&apos;écran d&apos;accueil »</b>.
              </>
            ) : (
              <>
                Ouvrez le menu de votre navigateur, puis{" "}
                <b>« Installer l&apos;application »</b> ou{" "}
                <b>« Ajouter à l&apos;écran d&apos;accueil »</b>. Si l&apos;entrée
                n&apos;apparaît pas, le site fonctionne aussi très bien dans un
                simple onglet.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
