"use client";

import { AnimatePresence, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { repondreDemande } from "@/app/actions/taxi-course";
import { usePoll } from "@/lib/use-poll";
import { cx, fullName } from "@/lib/format";

/**
 * Les demandes de course qui attendent une réponse.
 *
 * C'est l'écran qu'ouvre la notification. Un chauffeur y arrive au feu rouge,
 * téléphone à la main, avec quelques secondes devant lui : il doit voir qui
 * appelle, à quelle distance, vers où, et pouvoir répondre d'un doigt. Tout le
 * reste attend.
 *
 * Le compte à rebours est visible parce qu'il est réel. La demande expire seule,
 * côté serveur, et un chauffeur qui hésite doit savoir combien de temps il lui
 * reste plutôt que d'accepter dans le vide une course déjà partie.
 */

interface Demande {
  id: string;
  client_id: string;
  pickup_label: string | null;
  dest_label: string | null;
  distance_m: number | null;
  duration_min: number | null;
  seats: number;
  expires_at: string;
  created_at: string;
}

/** Ce que PostgREST répond quand la migration n'est pas encore collée. */
const TABLE_ABSENTE = ["42P01", "PGRST205", "PGRST202"];

export function DriverRequests({ driverId }: { driverId: string }) {
  const { t } = useI18n();
  const params = useSearchParams();
  /* La demande désignée par la notification : elle passe en tête et s'anime. */
  const cible = params.get("demande");

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [disponible, setDisponible] = useState(true);
  const [pending, startTransition] = useTransition();
  /* Pour redessiner les comptes à rebours sans relire la base. */
  const [tic, setTic] = useState(0);

  const relire = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("taxi_requests")
      .select("id, client_id, pickup_label, dest_label, distance_m, duration_min, seats, expires_at, created_at")
      .eq("driver_id", driverId)
      .eq("status", "en_attente")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      if (TABLE_ABSENTE.includes(error.code)) setDisponible(false);
      return false;
    }

    /*
      L'échéance est appliquée à la lecture, pas seulement par le nettoyage.

      Le nettoyage périodique passe toutes les quinze minutes ; une demande de
      trois minutes serait donc affichée bien après sa mort. Le filtre local
      évite de proposer « Accepter » sur une course que le serveur refusera.
    */
    const vivantes = (data ?? []).filter((d) => Date.parse(d.expires_at) > Date.now());
    setDemandes(vivantes);

    const inconnus = [...new Set(vivantes.map((d) => d.client_id))].filter((id) => !noms[id]);
    if (inconnus.length === 0) return;

    const { data: profils } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", inconnus);

    if (profils) {
      setNoms((actuels) => ({
        ...actuels,
        ...Object.fromEntries(profils.map((p) => [p.id, fullName(p) || t.taxi.aClient])),
      }));
    }
  }, [driverId, noms, t]);

  useEffect(() => {
    void relire();
    // `relire` change avec les noms découverts ; la relance périodique suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  /*
    Huit secondes.

    Plus rapide que tout le reste de l'écran, parce qu'une demande ne vit que
    trois minutes : la voir arriver avec trente secondes de retard, c'est en
    perdre un sixième. C'est le filet de sécurité derrière la notification, pour
    le chauffeur dont le téléphone a refusé les alertes.
  */
  usePoll(relire, 8_000);

  /* Le compte à rebours bat à la seconde ; la base, elle, n'est pas sollicitée. */
  useEffect(() => {
    if (demandes.length === 0) return;
    const timer = setInterval(() => setTic((n) => n + 1), 1_000);
    return () => clearInterval(timer);
  }, [demandes.length]);

  const listees = useMemo(() => {
    const vivantes = demandes.filter((d) => Date.parse(d.expires_at) > Date.now());
    if (!cible) return vivantes;

    // Celle qu'on vient d'ouvrir depuis la notification passe devant.
    return [...vivantes].sort((a, b) => (a.id === cible ? -1 : b.id === cible ? 1 : 0));
    // `tic` est volontairement dans les dépendances : c'est lui qui fait
    // disparaître une demande à la seconde où elle expire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandes, cible, tic]);

  function repondre(id: string, accepte: boolean) {
    // Retirée tout de suite : le chauffeur a répondu, la carte n'a plus lieu
    // d'être. Un aller-retour serveur de trois secondes laisserait sinon croire
    // que le geste n'a pas été pris.
    setDemandes((actuelles) => actuelles.filter((d) => d.id !== id));

    startTransition(async () => {
      const result = await repondreDemande(id, accepte);
      if (!result.ok) await relire();
    });
  }

  if (!disponible || listees.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[0.6875rem] font-bold text-[var(--color-ink)]">{t.taxi.requests}</h2>

      <AnimatePresence initial={false}>
        {listees.map((demande) => {
          const secondes = Math.max(
            0,
            Math.round((Date.parse(demande.expires_at) - Date.now()) / 1000),
          );

          const distance =
            demande.distance_m === null
              ? null
              : demande.distance_m < 1000
                ? `${demande.distance_m} m`
                : `${(demande.distance_m / 1000).toFixed(1)} km`;

          return (
            <m.article
              key={demande.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
              className={cx(
                "flex flex-col gap-[10px] rounded-[18px] bg-[var(--color-surface-solid)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)]",
                demande.id === cible &&
                  "ring-2 ring-[var(--color-brand-fill)] ring-offset-2 ring-offset-[var(--color-app)]",
              )}
            >
              <header className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-bold text-[var(--color-ink)]">
                    {noms[demande.client_id] ?? t.taxi.aClient}
                  </p>
                  <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                    {[
                      distance,
                      demande.seats > 1
                        ? t.taxi.passengers.replace("{n}", String(demande.seats))
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {/* Le temps restant, en clair. Il rougit sur la dernière minute :
                    c'est le moment où l'information cesse d'être indicative. */}
                <span
                  className={cx(
                    "flex-none rounded-full px-[9px] py-[3px] text-[0.5625rem] font-bold tabular-nums",
                    secondes <= 60
                      ? "bg-[var(--color-live-tint,rgba(200,60,60,0.12))] text-[var(--color-live)]"
                      : "bg-[var(--color-field)] text-[var(--color-muted)]",
                  )}
                >
                  {t.taxi.expiresIn.replace("{s}", String(secondes))}
                </span>
              </header>

              <div className="flex flex-col gap-[3px] rounded-[12px] bg-[var(--color-field)] px-[11px] py-[9px]">
                <p className="truncate text-[0.65625rem] text-[var(--color-ink)]">
                  <span className="text-[var(--color-muted)]">↑ </span>
                  {demande.pickup_label || t.taxi.pointOnMap}
                </p>
                {demande.dest_label && (
                  <p className="truncate text-[0.65625rem] font-semibold text-[var(--color-ink)]">
                    <span className="text-[var(--color-brand)]">↓ </span>
                    {demande.dest_label}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => repondre(demande.id, false)}
                  disabled={pending}
                  className="press flex-1 rounded-full border border-[var(--color-outline)] py-[10px] text-[0.6875rem] font-bold text-[var(--color-muted)] disabled:opacity-50"
                >
                  {t.taxi.refuse}
                </button>
                <button
                  type="button"
                  onClick={() => repondre(demande.id, true)}
                  disabled={pending}
                  className="press flex-[2] rounded-full bg-[var(--color-ink)] py-[10px] text-[0.6875rem] font-bold text-[var(--color-app)] disabled:opacity-50"
                >
                  {t.taxi.accept}
                </button>
              </div>
            </m.article>
          );
        })}
      </AnimatePresence>
    </section>
  );
}
