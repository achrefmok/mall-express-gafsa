"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  disconnectFacebookPage,
  refreshFacebookLives,
  retryFacebookSubscription,
} from "@/app/actions/facebook";
import { cx, formatDateTime } from "@/lib/format";
import { Button, Card, SectionTitle } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

export type FacebookLinkStatus = {
  pageName: string;
  isSubscribed: boolean;
  connectedAt: string;
  lastCheckedAt: string | null;
  lastError: string | null;
} | null;

/**
 * Liaison de la page Facebook de la boutique.
 *
 * Une fois reliée, un direct lancé depuis Facebook s'ouvre ici tout seul, avec
 * les commentaires, les réactions et l'achat. Le bouton « Vérifier maintenant »
 * couvre les deux cas où la notification n'arrive pas : autorisations encore en
 * attente chez Meta, ou événement perdu.
 */
export function FacebookLink({
  status,
  configured,
  locale,
}: {
  status: FacebookLinkStatus;
  /** L'application Meta est-elle renseignée côté serveur ? */
  configured: boolean;
  locale: AppLocale;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  // Messages posés par /api/facebook/callback au retour de Facebook.
  const outcome = params.get("facebook");
  const reason = params.get("motif");

  const banner =
    feedback ??
    (outcome === "connecte"
      ? { kind: "ok" as const, message: "Page reliée. Vos directs Facebook arriveront tout seuls." }
      : outcome === "connecte-sans-webhook"
        ? {
            kind: "error" as const,
            message:
              "Page reliée, mais Facebook a refusé la détection automatique. Utilisez « Vérifier maintenant » en attendant.",
          }
        : outcome === "annule"
          ? { kind: "error" as const, message: reason ?? "Connexion annulée." }
          : outcome === "erreur"
            ? { kind: "error" as const, message: reason ?? "La connexion a échoué." }
            : null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(
        result.ok
          ? { kind: "ok", message: success }
          : { kind: "error", message: result.error ?? "Échec" },
      );
      router.refresh();
    });
  }

  return (
    <section className="flex flex-none flex-col gap-2">
      <SectionTitle>Direct Facebook</SectionTitle>

      <Card className="flex flex-col gap-3 p-3">
        {!configured ? (
          <p className="text-[11.5px] leading-[1.55] text-[var(--color-muted)]">
            Le relais Facebook n&apos;est pas encore configuré sur ce site.
            L&apos;administration doit renseigner l&apos;application Meta.
          </p>
        ) : status ? (
          <>
            <div className="flex items-start gap-[10px]">
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[12px] font-bold text-[var(--color-brand)]">
                FB
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-[var(--color-ink)]">
                  {status.pageName}
                </p>
                <p className="text-[10.5px] text-[var(--color-muted)]">
                  Reliée le {formatDateTime(status.connectedAt, locale)}
                </p>
              </div>
            </div>

            <p
              className={cx(
                "rounded-[12px] px-[10px] py-2 text-[10.5px] leading-[1.5]",
                status.isSubscribed
                  ? "bg-[var(--color-brand-tint)] text-[var(--color-ink)]"
                  : "bg-[var(--color-live-tint)] text-[var(--color-ink)]",
              )}
            >
              {status.isSubscribed
                ? "Détection automatique active. Lancez votre direct depuis Facebook : il apparaîtra ici en quelques secondes, avec vos produits."
                : "Détection automatique indisponible — Facebook n'a pas accepté l'abonnement. Lancez votre direct, puis touchez « Vérifier maintenant »."}
            </p>

            {status.lastCheckedAt && (
              <p className="text-[9.5px] text-[var(--color-muted)]">
                Dernière vérification : {formatDateTime(status.lastCheckedAt, locale)}
              </p>
            )}

            {status.lastError && (
              <p className="text-[10px] leading-[1.45] text-[var(--color-live)]">
                {status.lastError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    async () => {
                      const result = await refreshFacebookLives();
                      return result.ok
                        ? { ok: true }
                        : { ok: false, error: result.error };
                    },
                    "Vérification faite.",
                  )
                }
              >
                {pending ? "…" : "Vérifier maintenant"}
              </Button>

              {!status.isSubscribed && (
                <Button
                  tone="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(retryFacebookSubscription, "Détection automatique activée.")}
                >
                  Réessayer l&apos;automatique
                </Button>
              )}

              <Button
                tone="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(disconnectFacebookPage, "Page déconnectée.")}
              >
                Déconnecter
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11.5px] leading-[1.55] text-[var(--color-muted)]">
              Reliez la page Facebook de votre boutique. Ensuite, il suffira de
              lancer votre direct depuis Facebook comme d&apos;habitude : il
              s&apos;affichera ici automatiquement, avec les commentaires, les
              réactions et l&apos;achat sans quitter la vidéo.
            </p>

            <a
              href="/api/facebook/connect"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[16px] bg-[var(--color-brand)] px-4 text-[12.5px] font-bold text-white"
            >
              Connecter ma page Facebook
            </a>

            <p className="text-[9.5px] leading-[1.45] text-[var(--color-muted)]">
              Nous lisons uniquement la liste de vos pages et leurs directs.
              Aucune publication n&apos;est faite en votre nom.
            </p>
          </>
        )}

        {banner && (
          <p
            role="status"
            className={cx(
              "text-[11px] leading-[1.5] font-semibold",
              banner.kind === "ok" ? "text-[var(--color-brand)]" : "text-[var(--color-live)]",
            )}
          >
            {banner.message}
          </p>
        )}
      </Card>
    </section>
  );
}
