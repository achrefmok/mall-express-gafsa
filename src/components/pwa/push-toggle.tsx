"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import { Card } from "@/components/ui/primitives";

/**
 * L'octet-à-octet attendu par `pushManager.subscribe`, depuis notre base64url.
 *
 * Le tampon est alloué explicitement plutôt que laissé au constructeur : depuis
 * TypeScript 5.7, `Uint8Array` porte le type de son tampon, et celui d'un
 * `new Uint8Array(n)` peut être un `SharedArrayBuffer` — que `subscribe` refuse.
 * Passer par un `ArrayBuffer` nommé lève l'ambiguïté sans conversion forcée.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));

  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Les deux clés de l'abonnement, en base64url, telles que le serveur les attend. */
function readKeys(subscription: PushSubscription): { p256dh: string; auth: string } | null {
  const json = subscription.toJSON();
  const keys = json.keys;
  if (!keys?.p256dh || !keys?.auth) return null;
  return { p256dh: keys.p256dh, auth: keys.auth };
}

/**
 * Rendre l'échec lisible.
 *
 * Un « réessayez dans un instant » ne dit rien à l'utilisateur et rien à celui
 * qui doit corriger : il faut savoir *quoi* a échoué. Les navigateurs donnent un
 * nom d'erreur précis — `NotAllowedError` pour une permission refusée,
 * `AbortError` quand le service de notification du navigateur ne répond pas,
 * `InvalidStateError` quand un abonnement existe déjà avec une autre clé.
 *
 * Le nom est affiché tel quel, sans traduction : il est destiné à être recopié
 * lors d'un signalement, et le traduire le rendrait introuvable.
 */
function describe(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name && error.name !== "Error" ? `${error.name} — ` : "";
    return `${name}${error.message || "cause inconnue"}`;
  }
  return String(error);
}

type State =
  | { kind: "checking" }
  /** Ni service worker, ni API de notifications — navigateur trop ancien. */
  | { kind: "unsupported" }
  /** Sur iPhone, hors application installée : Apple ne le permet pas. */
  | { kind: "needs-install" }
  | { kind: "off" }
  | { kind: "on" }
  /** Refus définitif : seuls les réglages du navigateur peuvent le lever. */
  | { kind: "blocked" };

/**
 * Recevoir les alertes sans ouvrir le site.
 *
 * C'est ce qui distingue une notification d'un simple message dans une liste :
 * la cloche du site suppose qu'on pense à venir voir. Une commande acceptée, un
 * direct qui démarre, une réponse du vendeur — ces trois événements perdent
 * l'essentiel de leur valeur s'ils attendent la prochaine visite.
 *
 * Ce que ce composant ne peut pas contourner : sur iPhone, Safari n'autorise les
 * notifications web que si le site a été **installé sur l'écran d'accueil**. Ce
 * n'est ni un défaut de notre code, ni un réglage à trouver — c'est une décision
 * d'Apple, et aucune bibliothèque ne la lève. On le dit plutôt que de laisser un
 * bouton sans effet, et on renvoie vers l'installation.
 */
export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

      /*
        L'ordre des vérifications compte.

        Un iPhone dans Safari annonce `PushManager` absent : le tester d'abord
        aurait affiché « navigateur non compatible », un message faux qui n'aide
        personne. La condition d'Apple est vérifiée avant.
      */
      if (isIOS && !installed) {
        if (!cancelled) setState({ kind: "needs-install" });
        return;
      }

      if (!supported) {
        if (!cancelled) setState({ kind: "unsupported" });
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState({ kind: "blocked" });
        return;
      }

      // Le service worker doit être prêt : c'est lui qui porte l'abonnement.
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (!cancelled) setState({ kind: existing ? "on" : "off" });
    }

    void detect().catch(() => {
      if (!cancelled) setState({ kind: "unsupported" });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setError(null);

    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState({ kind: permission === "denied" ? "blocked" : "off" });
          return;
        }

        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) {
          setError(t.push.notConfigured);
          return;
        }

        /*
          Attendre le service worker, mais pas indéfiniment.

          `serviceWorker.ready` ne rejette jamais : si aucun service worker n'est
          actif — première visite dont l'enregistrement n'a pas abouti, onglet
          privé, enregistrement refusé — la promesse reste en attente pour
          toujours, et le bouton semble simplement ne rien faire. Une limite de
          temps transforme ce silence en message.
        */
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Le service worker n'est pas actif sur cette page")),
              8000,
            ),
          ),
        ]);

        /*
          `userVisibleOnly: true` est obligatoire, pas optionnel : les navigateurs
          refusent tout abonnement qui n'engage pas à afficher quelque chose à
          l'écran. C'est ce qui empêche un site de recevoir des messages en
          silence pour suivre qui l'a installé.
        */
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });

        const keys = readKeys(subscription);
        if (!keys) {
          setError(t.common.error);
          return;
        }

        const result = await savePushSubscription({
          endpoint: subscription.endpoint,
          ...keys,
          userAgent: navigator.userAgent,
        });

        if (!result.ok) {
          // Ne pas laisser un abonnement vivant dans le navigateur alors que le
          // serveur l'ignore : il ne recevrait jamais rien, sans le savoir.
          await subscription.unsubscribe();
          setError(result.error);
          return;
        }

        setState({ kind: "on" });
      } catch (caught) {
        // Consigné aussi dans la console : le message affiché est court, la trace
        // complète y reste disponible pour un diagnostic.
        console.error("Activation des alertes impossible", caught);
        setError(`${t.push.failed} (${describe(caught)})`);
      }
    });
  }

  function disable() {
    setError(null);

    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }

        setState({ kind: "off" });
      } catch (caught) {
        console.error("Désactivation des alertes impossible", caught);
        setError(`${t.push.failed} (${describe(caught)})`);
      }
    });
  }

  if (state.kind === "checking") return null;

  const body =
    state.kind === "on"
      ? t.push.bodyOn
      : state.kind === "blocked"
        ? t.push.bodyBlocked
        : state.kind === "needs-install"
          ? t.push.bodyNeedsInstall
          : state.kind === "unsupported"
            ? t.push.bodyUnsupported
            : t.push.bodyOff;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-[var(--color-ink)]">{t.push.title}</p>
          <p className="mt-[2px] text-[10px] leading-[1.45] text-[var(--color-muted)]">{body}</p>
        </div>

        {(state.kind === "on" || state.kind === "off") && (
          <button
            type="button"
            onClick={state.kind === "on" ? disable : enable}
            role="switch"
            aria-checked={state.kind === "on"}
            aria-label={t.push.title}
            disabled={pending}
            className="relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-60"
            style={{
              background: state.kind === "on" ? "var(--color-ok, #2f7d5d)" : "var(--color-track)",
            }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white transition-[inset-inline-start]"
              style={{ insetInlineStart: state.kind === "on" ? "26px" : "4px" }}
            />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[10.5px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}
    </Card>
  );
}
