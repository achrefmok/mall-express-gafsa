"use client";

import { useCallback, useEffect, useState } from "react";

/** Événement non standard, absent de lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  /** Le navigateur nous a confié son invite : un seul geste suffit. */
  | { kind: "ready" }
  | { kind: "installed" }
  /** Aucune API disponible — il faut décrire le geste. Safari iOS, surtout. */
  | { kind: "manual" };

/**
 * L'installation en un geste, quand le navigateur le permet.
 *
 * Chrome et Edge — donc la quasi-totalité des téléphones Android — émettent
 * `beforeinstallprompt`. En le retenant, on peut déclencher l'installation
 * depuis notre propre bouton : un appui, une confirmation du système, terminé.
 *
 * Safari sur iPhone ne l'émet pas, et n'expose aucune API d'installation. Apple
 * réserve le geste à son menu de partage. Ce n'est pas une lacune de notre code
 * et aucune bibliothèque n'y change quoi que ce soit : sur iPhone, il faut
 * montrer le chemin. C'est ce que décrit `kind: "manual"`.
 *
 * Le crochet est partagé entre la page d'accueil publique et le profil : deux
 * copies auraient divergé, et celle qu'on aurait oublié de corriger est
 * justement celle qui compte — celle que voit un client déjà entré.
 */
/** Posé à l'installation : l'onglet du navigateur ne passe pas en mode application. */
const CLE_INSTALLEE = "meg-installee";

/** Ouverte depuis l'icône de l'écran d'accueil (ou une application Android empaquetée). */
function modeApplication(): boolean {
  return (
    ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    ) ||
    // Safari iOS : propriété propriétaire, absente du type Navigator.
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function lireInstallee(): boolean {
  try {
    return localStorage.getItem(CLE_INSTALLEE) === "1";
  } catch {
    return false;
  }
}

function ecrireInstallee(valeur: boolean) {
  try {
    if (valeur) localStorage.setItem(CLE_INSTALLEE, "1");
    else localStorage.removeItem(CLE_INSTALLEE);
  } catch {
    // Stockage refusé (navigation privée) : on s'en passe.
  }
}

export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>({ kind: "manual" });
  const [isIOS, setIsIOS] = useState(false);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  /*
    Faux au rendu serveur et au premier rendu client : tant qu'on ne sait pas
    si l'application est installée, un bouton « Installer » ne doit pas
    apparaître — il clignoterait dans l'application installée elle-même.
  */
  const [connu, setConnu] = useState(false);

  useEffect(() => {
    setConnu(true);

    /*
      Installée depuis cet onglet : Chrome n'émet plus d'invite, et l'onglet
      ne passe pas en mode application. Sans ce souvenir, le bouton
      reviendrait au rechargement suivant. Il s'efface dès que le navigateur
      propose à nouveau l'installation — c'est qu'elle a été désinstallée.
    */
    if (modeApplication() || lireInstallee()) {
      setState({ kind: "installed" });
      if (modeApplication()) return;
    }

    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));

    /*
      L'écoute est posée au montage, mais l'événement a pu passer avant.

      Le navigateur ne l'émet qu'une fois par chargement de page, souvent très
      tôt. Un composant monté après coup — et le profil l'est toujours — ne le
      verrait jamais. `service-worker-bridge` le capte donc au niveau du
      document et le rejoue ici.
    */
    const onPrompt = (incoming: Event) => {
      incoming.preventDefault();
      ecrireInstallee(false);
      setEvent(incoming as BeforeInstallPromptEvent);
      setState({ kind: "ready" });
    };
    const onInstalled = () => {
      ecrireInstallee(true);
      setState({ kind: "installed" });
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Invite déjà captée avant notre montage : on la reprend telle quelle.
    const held = (window as Window & { __megInstallEvent?: Event }).__megInstallEvent;
    if (held) onPrompt(held);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * Lance l'installation. Rend `false` si le navigateur n'en offre pas le moyen
   * — à l'appelant, alors, d'expliquer le geste.
   */
  const install = useCallback(async () => {
    if (!event) return false;

    /*
      L'invite ne sert qu'une fois, pour toute la page : un autre bouton
      (barre d'onglets, profil) a pu l'utiliser avant celui-ci. Elle lève
      alors une erreur — on retombe sur les explications.
    */
    let outcome: "accepted" | "dismissed";
    try {
      await event.prompt();
      ({ outcome } = await event.userChoice);
    } catch {
      setEvent(null);
      setState({ kind: "manual" });
      return false;
    }
    (window as Window & { __megInstallEvent?: Event }).__megInstallEvent = undefined;

    if (outcome === "accepted") {
      ecrireInstallee(true);
      setState({ kind: "installed" });
      return true;
    }

    /*
      Refus : l'invite est consommée et ne peut pas être relancée. Garder le
      bouton en « prêt » promettrait un geste qui ne produirait plus rien.
    */
    setEvent(null);
    setState({ kind: "manual" });
    return true;
  }, [event]);

  return { state, isIOS, install, canInstallInOneTap: state.kind === "ready", connu };
}
