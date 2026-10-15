"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";
import { useInstallPrompt } from "./use-install-prompt";
import { InstallGuide } from "./install-guide";

/**
 * « Installer G-Mall », toujours à portée tant que l'application ne l'est pas.
 *
 * Posé sur la barre d'onglets (téléphone) et dans la colonne latérale
 * (ordinateur). Il disparaît de lui-même :
 *   · dans l'application installée (mode `standalone`, iOS compris) ;
 *   · dès l'installation acceptée, sans recharger ;
 *   · avant que l'on sache : rien n'est rendu au serveur ni au premier rendu,
 *     pour ne jamais clignoter dans l'application installée.
 *
 * Un appui installe directement là où le navigateur le permet (Chrome, Edge,
 * Samsung Internet sur Android ; Chrome et Edge sur ordinateur). Ailleurs —
 * iPhone surtout, où Apple réserve le geste à son menu de partage —, il ouvre
 * les explications d'`InstallGuide`, les mêmes qu'à la page de préparation.
 */
export function BoutonInstaller({
  variante,
  app = "gmall",
}: {
  variante: "barre" | "colonne";
  /** L'application de transport a son propre nom (src/lib/transport.ts). */
  app?: "gmall" | "transport";
}) {
  const { t } = useI18n();
  const { state, canInstallInOneTap, install, connu } = useInstallPrompt();
  const [aide, setAide] = useState(false);

  if (!connu || state.kind === "installed") return null;

  const libelle = app === "transport" ? t.install.action : t.install.title;

  async function installer() {
    if (canInstallInOneTap && (await install())) return;
    setAide(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void installer()}
        className={cx(
          "press flex items-center gap-[6px] font-bold",
          variante === "barre"
            ? "rounded-full bg-[var(--color-brand-fill)] px-3 py-[6px] text-[0.6875rem] text-white shadow-[0_6px_18px_rgba(40,25,60,0.28)]"
            : "min-h-[40px] w-full rounded-[14px] border border-[var(--color-outline)] px-3 text-[0.78125rem] text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand-tint)]",
        )}
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        {libelle}
      </button>

      {aide && <AideInstallation titre={libelle} onFermer={() => setAide(false)} />}
    </>
  );
}

/**
 * Les explications, en feuille montant du bas. Rendue dans `body` : la barre
 * d'onglets vit sous `PageTransition`, dont l'animation piégerait un `fixed`.
 */
function AideInstallation({ titre, onFermer }: { titre: string; onFermer: () => void }) {
  const { t } = useI18n();
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);

  if (!monte) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titre} className="fixed inset-0 z-[95] flex items-end justify-center">
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onFermer}
        className="absolute inset-0 bg-[rgba(30,20,45,0.45)]"
      />
      <div className="animate-slide-up pb-safe relative w-full max-w-[520px] rounded-t-[24px] bg-[var(--color-surface-solid)] p-4 shadow-[0_-10px_40px_rgba(40,25,60,0.28)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-hairline)]" aria-hidden />
        <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{titre}</h2>
        <p className="mt-1 mb-3 text-[0.71875rem] leading-[1.5] text-[var(--color-muted)]">{t.install.body}</p>
        <InstallGuide etapesSeules />
        <button
          type="button"
          onClick={onFermer}
          className="mt-2 w-full py-2 text-[0.71875rem] font-semibold text-[var(--color-muted)]"
        >
          {t.common.close}
        </button>
      </div>
    </div>,
    document.body,
  );
}
