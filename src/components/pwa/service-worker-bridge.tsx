"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { WelcomeScreen } from "@/components/shell/welcome-screen";
import { InvitationRoue } from "@/components/roue/invitation-roue";
import { EcranOuvertureTransport } from "@/components/transport/ecran-ouverture";
import { AncreRetour } from "./ancre-retour";

/**
 * Trois responsabilités, volontairement réunies dans un seul composant monté
 * une fois dans la racine :
 *   · enregistrer le service worker ;
 *   · proposer l'installation quand le navigateur le permet ;
 *   · signaler la perte de réseau.
 */
export function ServiceWorkerBridge({
  logo,
  app = "gmall",
}: {
  logo?: string | null;
  /** « Taxi & Louage Gafsa » a son propre écran d'ouverture, sans sponsors ni roue. */
  app?: "gmall" | "transport";
}) {
  return (
    <>
      <ServiceWorkerRegistration />
      <AncreRetour app={app} />
      <InstallCapture />
      {/* Monté ici plutôt que dans une coque : il doit couvrir l'écran quelle
          que soit la page d'entrée, y compris une fiche produit partagée. */}
      {app === "transport" ? (
        <EcranOuvertureTransport />
      ) : (
        <>
          <WelcomeScreen logo={logo} />
          {/* Après l écran d ouverture, et une fois par jour seulement. */}
          <InvitationRoue />
        </>
      )}
      <OfflineBanner />
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
      className="fixed inset-x-0 top-0 z-[60] bg-[var(--color-ink)] px-4 py-2 text-center text-[0.6875rem] font-semibold text-[var(--color-app)]"
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

/*
  Le bandeau d'invitation à installer a laissé place à `BoutonInstaller`, posé
  sur la barre d'onglets : fixé en bas de l'écran, il la recouvrait.
*/
