"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
  webhookEnabled,
  locale,
}: {
  status: FacebookLinkStatus;
  /** L'application Meta est-elle renseignée côté serveur ? */
  configured: boolean;
  /** L'application a-t-elle le droit de s'abonner au webhook Facebook ? */
  webhookEnabled: boolean;
  locale: AppLocale;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  /*
    Résultat posé dans l'URL par /api/facebook/callback — seul moyen pour une
    route d'API de parler à un écran.

    Capturé au premier rendu, et non relu à chaque fois : l'effet ci-dessous
    nettoie l'URL, et un message dérivé des paramètres disparaîtrait aussitôt.
  */
  const [arrival] = useState(() => ({
    outcome: params.get("facebook"),
    reason: params.get("motif"),
  }));

  const { outcome, reason } = arrival;

  const banner =
    feedback ??
    (outcome === "connecte"
      ? { kind: "ok" as const, message: "Page reliée. Vos directs Facebook arriveront tout seuls." }
      : outcome === "connecte-planifie"
        ? {
            kind: "ok" as const,
            message:
              "Page reliée. Vos directs seront repris automatiquement, au plus tard un quart d’heure après leur lancement.",
          }
        : outcome === "annule"
          ? { kind: "error" as const, message: reason ?? "Connexion annulée." }
          : outcome === "erreur"
            ? { kind: "error" as const, message: reason ?? "La connexion a échoué." }
            : null);

  // Cas particulier : compte sans page. Ce n'est pas un échec, c'est un
  // aiguillage — d'où un encart avec les deux chemins possibles, plutôt
  // qu'une ligne rouge sans issue.
  const noPage = outcome === "sans-page";

  /*
    Le résultat reste dans l'URL après lecture : un rechargement, un retour
    arrière ou un lien partagé ressuscitent alors un message périmé — on a vu
    un ancien « aucune page rattachée » réapparaître après une tentative
    entièrement différente.

    On nettoie donc l'URL, une seule fois. `replace` et non `push` : la
    bascule ne doit pas s'empiler dans l'historique du navigateur.
  */
  useEffect(() => {
    if (!outcome) return;

    const next = new URLSearchParams(window.location.search);
    next.delete("facebook");
    next.delete("motif");

    // Chemin et requête séparés : une interpolation collée au chemin ferait
    // lire « /vendeur/reglages[param] » à `npm run check:links`, qui n'a aucun
    // moyen de distinguer un segment dynamique d'une chaîne de requête.
    const query = next.toString();
    const target = query ? `/vendeur/reglages?${query}` : "/vendeur/reglages";

    router.replace(target, { scroll: false });
    // `outcome` vient d'un état figé au premier rendu : cet effet ne tourne
    // qu'une fois, et ne réagit pas au changement d'URL qu'il provoque.
  }, [outcome, router]);

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
                "rounded-[12px] bg-[var(--color-brand-tint)] px-[10px] py-2 text-[10.5px] leading-[1.5] text-[var(--color-ink)]",
              )}
            >
              {status.isSubscribed
                ? "Détection immédiate active. Lancez votre direct depuis Facebook : il apparaîtra ici en quelques secondes, avec vos produits."
                : "Reprise automatique active. Lancez votre direct depuis Facebook : il apparaîtra ici au plus tard un quart d’heure après. Pour ne pas attendre, touchez « Vérifier maintenant »."}
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

              {webhookEnabled && !status.isSubscribed && (
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

            {noPage && (
              <div className="flex flex-col gap-3 rounded-[16px] bg-[var(--color-brand-tint)] p-3">
                <p className="text-[11.5px] font-bold text-[var(--color-ink)]">
                  Votre compte Facebook n&apos;administre aucune page
                </p>
                <p className="text-[11px] leading-[1.55] text-[var(--color-muted)]">
                  La reprise automatique lit les directs d&apos;une{" "}
                  <strong>page</strong> ; Facebook ne l&apos;autorise pas pour un
                  profil personnel. Deux chemins s&apos;offrent à vous.
                </p>

                <ol className="flex flex-col gap-[10px]">
                  <li className="flex gap-[10px]">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-[11px] font-bold text-[var(--color-brand)]">
                      1
                    </span>
                    <span className="text-[11px] leading-[1.55] text-[var(--color-ink)]">
                      <strong>Créer une page</strong> pour votre boutique — gratuit,
                      deux minutes, et c&apos;est de toute façon ce que cherchent vos
                      clients sur Facebook. Revenez ensuite ici.
                      <a
                        href="https://www.facebook.com/pages/create"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block font-bold text-[var(--color-brand)]"
                      >
                        Créer ma page sur Facebook ↗
                      </a>
                    </span>
                  </li>

                  <li className="flex gap-[10px]">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-[11px] font-bold text-[var(--color-brand)]">
                      2
                    </span>
                    <span className="text-[11px] leading-[1.55] text-[var(--color-ink)]">
                      <strong>Garder votre profil</strong> et coller le lien à chaque
                      direct. Cela marche dès maintenant, à condition que la vidéo
                      soit <strong>publique</strong>.
                      <Link
                        href="/vendeur/lives/nouveau"
                        className="mt-1 block font-bold text-[var(--color-brand)]"
                      >
                        Programmer un direct à relayer →
                      </Link>
                    </span>
                  </li>
                </ol>
              </div>
            )}
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
