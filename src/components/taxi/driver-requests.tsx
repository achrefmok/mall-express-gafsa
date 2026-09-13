"use client";

import { AnimatePresence, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import {
  repondreDemande,
  marquerChauffeurEnRoute,
  marquerPassagerPris,
  marquerCourseEnCours,
  marquerCourseTerminee,
} from "@/app/actions/taxi-course";
import { repondreDemandeDiffusee } from "@/app/actions/taxi-matching";
import { usePoll } from "@/lib/use-poll";
import { nomZone, type TaxiZoneId } from "@/lib/taxi-zones";
import { cx, fullName } from "@/lib/format";

/**
 * Ce qui attend une réponse, sur l'espace du chauffeur.
 *
 * Deux façons de demander une course existent à Gafsa, et les deux arrivent
 * ici :
 *
 *   · **la demande directe** — le client a choisi sa fiche sur la carte et
 *     s'adresse à lui seul. Elle vit dans `taxi_requests`, adressée à lui.
 *   · **la demande diffusée** — le client annonce sa destination à toute la
 *     ville, et le serveur apparie les chauffeurs compatibles. Chaque offre
 *     est une ligne de `taxi_request_matches`, adressée à lui aussi, qui
 *     arrive en temps réel et disparaît quand un autre chauffeur a accepté.
 *
 * Le temps réel porte la diffusion — le volume reste minuscule à côté de la
 * rafale GPS qui avait fait sortir les positions — et la relecture périodique
 * ne sert qu'aux demandes directes et aux connexions qui perdraient un
 * événement. Il est lent exprès : une course n'apparaît jamais seulement par
 * lui.
 *
 * Deux familles de diffusion, parce que leur contrat diffère :
 *
 *   · sur mon trajet — la destination est une zone, exactement la sienne.
 *   · demandes personnalisées — le client part vers « autre » ; elles ne
 *     tombent que chez ceux qui ont dit les accepter.
 */

/**
 * Une demande adressée à ce chauffeur précis (chemin « choisir une fiche »).
 */
interface DemandeDirecte {
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

/** Une offre de course diffusée par le matching par trajet. */
interface DemandeDiffusee {
  request_id: string;
  pickup_label: string | null;
  origin_zone: string | null;
  destination_zone: string | null;
  destination_type: "zone" | "autre";
  destination_name: string | null;
  proposed_price: number | null;
  seats: number | null;
  expires_at: string | null;
  created_at: string;
}

/** Une course acceptée en cours de progression. */
interface CourseActive {
  id: string;
  client_id: string;
  pickup_label: string | null;
  dest_label: string | null;
  status: import("@/types/database").TaxiRequestStatus;
  proposed_price: number | null;
  accepted_price: number | null;
  seats: number;
  created_at: string;
}

function distanceTexte(distance: number | null): string | null {
  if (distance === null) return null;
  return distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`;
}

export function DriverRequests({ driverId }: { driverId: string }) {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  /* La demande désignée par la notification : elle passe en tête et s'anime. */
  const cible = params.get("demande");

  const [directes, setDirectes] = useState<DemandeDirecte[]>([]);
  const [demandes, setDemandes] = useState<DemandeDiffusee[]>([]);
  const [coursesActives, setCoursesActives] = useState<CourseActive[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  /* Pour redessiner les comptes à rebours sans relire la base. */
  const [tic, setTic] = useState(0);

  /*
    Le référence la plus fraîche de la relecture.
    
    Le temps réel l'appelle depuis une fermeture qui serait sinon figée à la
    première version de `noms` ; en passant par une référence, l'événement
    utilise toujours la relecture qui connaît les derniers prénoms découverts.
  */
  const relireRef = useRef<() => Promise<void>>(async () => {});
  relireRef.current = async () => void relire();

  const relire = useCallback(async () => {
    const supabase = createClient();

    const [resultatDirect, resultatDiffusion, resultatActives] = await Promise.all([
      supabase
        .from("taxi_requests")
        .select(
          "id, client_id, pickup_label, dest_label, distance_m, duration_min, seats, expires_at, created_at",
        )
        .eq("driver_id", driverId)
        .eq("status", "en_attente")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("taxi_request_matches")
        .select(
          "request_id, pickup_label, origin_zone, destination_zone, destination_type, destination_name, proposed_price, seats, expires_at, created_at",
        )
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("taxi_requests")
        .select(
          "id, client_id, pickup_label, dest_label, status, proposed_price, accepted_price, seats, created_at",
        )
        .eq("driver_id", driverId)
        .in("status", ["acceptee", "driver_arriving", "picked_up", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (resultatDiffusion.error) {
      // Migration non collée : la diffusion reste muette, sans faire tomber
      // l'écran — les demandes directes, elles, continuent de vivre.
      setDemandes([]);
    } else {
      setDemandes((resultatDiffusion.data ?? []) as DemandeDiffusee[]);
    }

    if (!resultatActives.error) {
      setCoursesActives((resultatActives.data ?? []) as CourseActive[]);
    }

    /*
      L'échéance est appliquée à la lecture, pas seulement par le nettoyage.
      
      Le nettoyage périodique passe toutes les quinze minutes ; une demande de
      trois minutes serait donc affichée bien après sa mort. Le filtre local
      évite de proposer « Accepter » sur une course que le serveur refusera.
    */
    const vivantes = (resultatDirect.data ?? []).filter((d) =>
      Date.parse(d.expires_at) > Date.now(),
    );
    setDirectes(vivantes);

    const inconnus = [
      ...new Set([
        ...vivantes.map((d) => d.client_id),
        ...(resultatActives.data ?? []).map((c: CourseActive) => c.client_id),
      ]),
    ].filter((id) => !noms[id]);
    if (inconnus.length > 0) {
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
    }

    return resultatDirect.error ? false : undefined;
  }, [driverId, noms, t]);

  useEffect(() => {
    void relire();
    // `relire` change avec les noms découverts ; la relance périodique suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  /*
    Le temps réel, un abonnement par chauffeur.
    
    Les offres de diffusion naissent et meurent ici : chaque ligne nouvelle
    glisse sa carte en tête, chaque suppression — acceptée par un autre,
    annulée, expirée — retire la sienne. Les demandes directes, moins vives,
    sont relues aux événements ; l'expiration est portée par le nettoyage.
  */
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`demandes-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "taxi_request_matches",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const ligne = payload.new as DemandeDiffusee;
          if (!ligne?.request_id) return;
          setDemandes((actuelles) => [
            ligne,
            ...actuelles.filter((d) => d.request_id !== ligne.request_id),
          ]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "taxi_request_matches" },
        (payload) => {
          const vieille = payload.old as { request_id?: string };
          if (!vieille?.request_id) return;
          setDemandes((actuelles) => actuelles.filter((d) => d.request_id !== vieille.request_id));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "taxi_requests", filter: `driver_id=eq.${driverId}` },
        () => void relireRef.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [driverId]);

  /*
    Un filet de sécurité, pas un sondage de recherche.
    
    Le temps réel porte le flux ; la relecture périodique ne sert qu'à
    rattraper une connexion qui aurait perdu un événement. Elle est lente
    exprès : une course n'apparaît jamais à l'écran uniquement grâce à elle.
  */
  usePoll(relire, 25_000);

  /* Le compte à rebours bat à la seconde ; la base, elle, n'est pas sollicitée. */
  useEffect(() => {
    if (directes.length === 0 && demandes.length === 0) return;
    const timer = setInterval(() => setTic((n) => n + 1), 1_000);
    return () => clearInterval(timer);
  }, [directes.length, demandes.length]);

  const vivantes = useMemo(
    () =>
      demandes.filter(
        (d) => d.expires_at === null || Date.parse(d.expires_at) > Date.now(),
      ),
    // `tic` force la disparition exacte à la seconde de l'expiration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demandes, tic],
  );

  const controleures = useMemo(() => {
    const vivantesDirectes = directes.filter((d) => Date.parse(d.expires_at) > Date.now());
    if (!cible) return vivantesDirectes;
    // Celle qu'on vient d'ouvrir depuis la notification passe devant.
    return [...vivantesDirectes].sort((a, b) => (a.id === cible ? -1 : b.id === cible ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directes, cible, tic]);

  const liste = useMemo(() => {
    if (!cible) return vivantes;
    // Celle qu'on vient d'ouvrir depuis la notification passe devant.
    return [...vivantes].sort((a, b) => (a.request_id === cible ? -1 : b.request_id === cible ? 1 : 0));
  }, [vivantes, cible]);

  const surLeTrajet = liste.filter((d) => d.destination_type === "zone");
  const personnalisees = liste.filter((d) => d.destination_type === "autre");

  /** Avancer le statut d'une course active. */
  function avancerCourse(id: string, action: "arriving" | "picked" | "start" | "complete") {
    setCoursesActives((actuelles) =>
      action === "complete"
        ? actuelles.filter((c) => c.id !== id)
        : actuelles.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: (
                    { arriving: "driver_arriving", picked: "picked_up", start: "in_progress" } as const
                  )[action],
                }
              : c,
          ),
    );

    startTransition(async () => {
      let result;
      switch (action) {
        case "arriving":
          result = await marquerChauffeurEnRoute(id);
          break;
        case "picked":
          result = await marquerPassagerPris(id);
          break;
        case "start":
          result = await marquerCourseEnCours(id);
          break;
        case "complete":
          result = await marquerCourseTerminee(id);
          break;
      }
      if (!result?.ok) await relire();
    });
  }

  /** Répondre à une offre diffusée. */
  function repondre(id: string, accepte: boolean) {
    // Retirée tout de suite : le chauffeur a répondu, la carte n'a plus lieu
    // d'être. Un aller-retour serveur de trois secondes laisserait sinon croire
    // que le geste n'a pas été pris.
    setDemandes((actuelles) => actuelles.filter((d) => d.request_id !== id));

    startTransition(async () => {
      const result = await repondreDemandeDiffusee(id, accepte);
      if (!result.ok) await relire();
    });
  }

  /** Répondre à une demande adressée à ce chauffeur précis. */
  function repondreDirect(id: string, accepte: boolean) {
    setDirectes((actuelles) => actuelles.filter((d) => d.id !== id));

    startTransition(async () => {
      const result = await repondreDemande(id, accepte);
      if (!result.ok) await relire();
    });
  }

  if (liste.length === 0 && controleures.length === 0 && coursesActives.length === 0) return null;

  const titreNom = (zone: string | null) => nomZone(zone as TaxiZoneId | null, locale);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[0.6875rem] font-bold text-[var(--color-ink)]">{t.taxi.requests}</h2>

      {/* ─── Courses en cours ──────────────────────────────────────────── */}
      {coursesActives.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[0.5625rem] font-bold tracking-[0.05em] text-[var(--color-ok,#2f7d5d)] uppercase">
            🚕 {t.taxi.courseInProgress ?? "En cours"}
          </p>
          <AnimatePresence initial={false}>
            {coursesActives.map((course) => (
              <CourseActiveCard
                key={course.id}
                course={course}
                nom={noms[course.client_id] ?? t.taxi.aClient}
                pending={pending}
                onAvancer={avancerCourse}
                t={t}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Demandes directes : le client a choisi sa fiche ─────────── */}
      {controleures.length > 0 && (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {controleures.map((demande) => (
              <CarteDirecte
                key={`${demande.id}-${demande.client_id}`}
                demande={demande}
                nom={noms[demande.client_id] ?? t.taxi.aClient}
                cible={cible}
                pending={pending}
                onRepondre={repondreDirect}
                expiresIn={t.taxi.expiresIn}
                passengers={t.taxi.passengers}
                refuser={t.taxi.refuse}
                accepter={t.taxi.accept}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Sur mon trajet ──────────────────────────────────────────── */}
      {surLeTrajet.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[0.5625rem] font-bold tracking-[0.05em] text-[var(--color-faint)] uppercase">
            {t.taxi.orderCompatible}
          </p>
          <AnimatePresence initial={false}>
            {surLeTrajet.map((demande) => (
              <CarteDiffusee
                key={`${demande.request_id}-${demande.destination_type}`}
                demande={demande}
                nomZone={titreNom}
                cible={cible}
                pending={pending}
                onRepondre={repondre}
                expiresIn={t.taxi.expiresIn}
                passengers={t.taxi.passengers}
                dt={t.taxi.orderDt}
                autreLabel={t.taxi.orderAutre}
                refuser={t.taxi.refuse}
                accepter={t.taxi.accept}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Demandes personnalisées ─────────────────────────────────── */}
      {personnalisees.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 pt-1 text-[0.5625rem] font-bold tracking-[0.05em] text-[var(--color-faint)] uppercase">
            {t.taxi.orderCustoms}
          </p>
          <AnimatePresence initial={false}>
            {personnalisees.map((demande) => (
              <CarteDiffusee
                key={`${demande.request_id}-${demande.destination_type}`}
                demande={demande}
                nomZone={titreNom}
                cible={cible}
                pending={pending}
                onRepondre={repondre}
                expiresIn={t.taxi.expiresIn}
                passengers={t.taxi.passengers}
                dt={t.taxi.orderDt}
                autreLabel={t.taxi.orderAutre}
                refuser={t.taxi.refuse}
                accepter={t.taxi.accept}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

/** Une demande adressée à ce chauffeur précis : nom du client, distance, trajet. */
function CarteDirecte({
  demande,
  nom,
  cible,
  pending,
  onRepondre,
  expiresIn,
  passengers,
  refuser,
  accepter,
}: {
  demande: DemandeDirecte;
  nom: string;
  cible: string | null;
  pending: boolean;
  onRepondre: (id: string, accepte: boolean) => void;
  expiresIn: string;
  passengers: string;
  refuser: string;
  accepter: string;
}) {
  const secondes = Math.max(0, Math.round((Date.parse(demande.expires_at) - Date.now()) / 1000));
  const distance = distanceTexte(demande.distance_m);

  return (
    <m.article
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
          <p className="truncate text-[0.8125rem] font-bold text-[var(--color-ink)]">{nom}</p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {[
              distance,
              demande.seats > 1 ? passengers.replace("{n}", String(demande.seats)) : null,
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
          {expiresIn.replace("{s}", String(secondes))}
        </span>
      </header>

      <div className="flex flex-col gap-[3px] rounded-[12px] bg-[var(--color-field)] px-[11px] py-[9px]">
        <p className="truncate text-[0.65625rem] text-[var(--color-ink)]">
          <span className="text-[var(--color-muted)]">↑ </span>
          {demande.pickup_label || "🚩"}
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
          onClick={() => onRepondre(demande.id, false)}
          disabled={pending}
          className="press flex-1 rounded-full border border-[var(--color-outline)] py-[10px] text-[0.6875rem] font-bold text-[var(--color-muted)] disabled:opacity-50"
        >
          {refuser}
        </button>
        <button
          type="button"
          onClick={() => onRepondre(demande.id, true)}
          disabled={pending}
          className="press flex-[2] rounded-full bg-[var(--color-ink)] py-[10px] text-[0.6875rem] font-bold text-[var(--color-app)] disabled:opacity-50"
        >
          {accepter}
        </button>
      </div>
    </m.article>
  );
}

/**
 * La carte d'une offre diffusée.
 *
 * Une fonction dédiée plutôt qu'une boucle réécrite deux fois : sur le trajet
 * ou personnalisée, la carte est la même, seule la destination change.
 */
function CarteDiffusee({
  demande,
  cible,
  pending,
  onRepondre,
  nomZone,
  expiresIn,
  passengers,
  dt,
  autreLabel,
  refuser,
  accepter,
}: {
  demande: DemandeDiffusee;
  cible: string | null;
  pending: boolean;
  onRepondre: (id: string, accepte: boolean) => void;
  nomZone: (zone: string | null) => string | null;
  expiresIn: string;
  passengers: string;
  dt: string;
  autreLabel: string;
  refuser: string;
  accepter: string;
}) {
  const destination =
    demande.destination_type === "zone"
      ? nomZone(demande.destination_zone)
      : (demande.destination_name?.trim() ?? autreLabel);

  const secondes =
    demande.expires_at === null
      ? 0
      : Math.max(0, Math.round((Date.parse(demande.expires_at) - Date.now()) / 1000));

  const details = [
    demande.proposed_price !== null ? `💰 ${demande.proposed_price} ${dt}` : null,
    demande.seats !== null && demande.seats > 1
      ? passengers.replace("{n}", String(demande.seats))
      : null,
    demande.pickup_label ? `↑ ${demande.pickup_label}` : null,
  ].filter(Boolean);

  return (
    <m.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
      className={cx(
        "flex flex-col gap-[10px] rounded-[18px] bg-[var(--color-surface-solid)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)]",
        demande.request_id === cible &&
          "ring-2 ring-[var(--color-brand-fill)] ring-offset-2 ring-offset-[var(--color-app)]",
      )}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold text-[var(--color-ink)]">{destination}</p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">{details.join(" · ")}</p>
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
          {expiresIn.replace("{s}", String(secondes))}
        </span>
      </header>

      <div className="flex flex-col gap-[3px] rounded-[12px] bg-[var(--color-field)] px-[11px] py-[9px]">
        <p className="truncate text-[0.65625rem] text-[var(--color-ink)]">
          <span className="text-[var(--color-muted)]">↑ </span>
          {nomZone(demande.origin_zone) || demande.pickup_label || "🚩"}
        </p>
        <p className="truncate text-[0.65625rem] font-semibold text-[var(--color-ink)]">
          <span className="text-[var(--color-brand)]">↓ </span>
          {destination}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onRepondre(demande.request_id, false)}
          disabled={pending}
          className="press flex-1 rounded-full border border-[var(--color-outline)] py-[10px] text-[0.6875rem] font-bold text-[var(--color-muted)] disabled:opacity-50"
        >
          {refuser}
        </button>
        <button
          type="button"
          onClick={() => onRepondre(demande.request_id, true)}
          disabled={pending}
          className="press flex-[2] rounded-full bg-[var(--color-ink)] py-[10px] text-[0.6875rem] font-bold text-[var(--color-app)] disabled:opacity-50"
        >
          {accepter}
        </button>
      </div>
    </m.article>
  );
}

/** Carte d'une course active avec boutons de progression d'état. */
function CourseActiveCard({
  course,
  nom,
  pending,
  onAvancer,
  t,
}: {
  course: CourseActive;
  nom: string;
  pending: boolean;
  onAvancer: (id: string, action: "arriving" | "picked" | "start" | "complete") => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
type CourseState = "acceptee" | "driver_arriving" | "picked_up" | "in_progress" | "completed";

  const statutLabel: Record<CourseState, string> = {
    acceptee: t.taxi.orderConfirmed,
    driver_arriving: t.taxi.courseDriverArriving,
    picked_up: t.taxi.coursePickedUp,
    in_progress: t.taxi.courseInProgress,
    completed: t.taxi.courseCompleted,
  };

  const statutIcon: Record<CourseState, string> = {
    acceptee: "✅",
    driver_arriving: "🚗",
    picked_up: "🤝",
    in_progress: "🚕",
    completed: "🏁",
  };

  const nextAction: Record<CourseState, "arriving" | "picked" | "start" | "complete" | null> = {
    acceptee: "arriving",
    driver_arriving: "picked",
    picked_up: "start",
    in_progress: "complete",
    completed: null,
  };

  const nextLabel: Record<string, string> = {
    arriving: t.taxi.courseBtnArriving,
    picked: t.taxi.courseBtnPicked,
    start: t.taxi.courseBtnStart,
    complete: t.taxi.courseBtnComplete,
  };

  const action = course.status in nextAction ? nextAction[course.status as CourseState] : null;

  return (
    <m.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-[10px] rounded-[18px] bg-[rgba(47,125,93,0.08)] p-3 shadow-[0_6px_18px_rgba(47,125,93,0.1)]"
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold text-[var(--color-ink)]">{nom}</p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {statutIcon[course.status as CourseState]} {statutLabel[course.status as CourseState]}
          </p>
        </div>
        {course.accepted_price !== null && (
          <span className="flex-none rounded-full bg-[var(--color-surface-solid)] px-[9px] py-[3px] text-[0.5625rem] font-bold text-[var(--color-brand)]">
            💰 {course.accepted_price} {t.taxi.orderDt}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-[3px] rounded-[12px] bg-[var(--color-field)] px-[11px] py-[9px]">
        <p className="truncate text-[0.65625rem] text-[var(--color-ink)]">
          <span className="text-[var(--color-muted)]">↑ </span>
          {course.pickup_label || "🚩"}
        </p>
        {course.dest_label && (
          <p className="truncate text-[0.65625rem] font-semibold text-[var(--color-ink)]">
            <span className="text-[var(--color-brand)]">↓ </span>
            {course.dest_label}
          </p>
        )}
      </div>

      {action && (
        <m.button
          type="button"
          onClick={() => onAvancer(course.id, action)}
          disabled={pending}
          whileTap={{ scale: 0.97 }}
          className="press w-full rounded-full bg-[var(--color-brand-fill)] py-[11px] text-[0.75rem] font-bold text-white shadow-[0_4px_12px_rgba(131,56,228,0.25)] disabled:opacity-50"
        >
          {nextLabel[action]}
        </m.button>
      )}

      {course.status === "completed" && (
        <div className="flex items-center justify-center rounded-full bg-[rgba(47,125,93,0.12)] py-[10px] text-[0.75rem] font-bold text-[var(--color-ok,#2f7d5d)]">
          🏁 {t.taxi.courseCompleted}
        </div>
      )}
    </m.article>
  );
}