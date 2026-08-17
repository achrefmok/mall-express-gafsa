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
export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>({ kind: "manual" });
  const [isIOS, setIsIOS] = useState(false);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS : propriété propriétaire, absente du type Navigator.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setState({ kind: "installed" });
      return;
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
      setEvent(incoming as BeforeInstallPromptEvent);
      setState({ kind: "ready" });
    };
    const onInstalled = () => setState({ kind: "installed" });

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

    await event.prompt();
    const { outcome } = await event.userChoice;

    if (outcome === "accepted") {
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

  return { state, isIOS, install, canInstallInOneTap: state.kind === "ready" };
}
