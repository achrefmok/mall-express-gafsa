"use client";

import { AnimatePresence, m } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { format } from "@/lib/i18n/format";
import {
  annulerDemandeDiffusee,
  confirmerCourse,
  creerDemandeMatching,
} from "@/app/actions/taxi-matching";
import { TAXI_ZONES, nomZone, zoneLaPlusProche, type TaxiZoneId } from "@/lib/taxi-zones";
import { cx } from "@/lib/format";
import { DriverChat } from "./driver-chat";
import type { Point } from "@/lib/taxi-match";

/**
 * Commander un taxi avec animation premium.
 *
 * Le flux complet :
 *   saisie → envoi → recherche (overlay blur) → acceptee → course (states)
 *                                                         → completed
 */

type Etape =
  | "saisie"
  | "envoi"
  | "recherche"
  | "acceptee"
  | "course"
  | "fin";

type StatutCourse =
  | "acceptee"
  | "driver_arriving"
  | "picked_up"
  | "in_progress"
  | "completed";

interface ChauffeurAttribue {
  id: string;
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
}

const ZONES_TAXI = TAXI_ZONES;

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

export function TaxiOrderSheet({
  open,
  onClose,
  clientId,
  depart,
  departNom,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string | null;
  depart: Point | null;
  departNom: string | null;
}) {
  const { t, locale } = useI18n();

  const [etape, setEtape] = useState<Etape>("saisie");
  const [origine, setOrigine] = useState<TaxiZoneId | null>(null);
  const [destinationType, setDestinationType] = useState<"zone" | "autre">("zone");
  const [arrivee, setArrivee] = useState<TaxiZoneId | null>(null);
  const [autre, setAutre] = useState("");
  const [budget, setBudget] = useState("");
  const [sieges, setSieges] = useState(1);

  const [demandeId, setDemandeId] = useState<string | null>(null);
  const [echeance, setEcheance] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chauffeur, setChauffeur] = useState<ChauffeurAttribue | null>(null);
  const [statutCourse, setStatutCourse] = useState<StatutCourse>("acceptee");
  const [confirme, setConfirme] = useState(false);
  const [discussion, setDiscussion] = useState(false);
  const [pending, startTransition] = useTransition();
  const [, setTic] = useState(0);
  const canalRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrigine(zoneLaPlusProche(depart));
  }, [open, depart]);

  function fermer() {
    const id = demandeId;
    if (id && (etape === "recherche" || etape === "acceptee")) {
      startTransition(async () => void (await annulerDemandeDiffusee(id)));
    }
    if (canalRef.current) {
      canalRef.current.unsubscribe();
      canalRef.current = null;
    }
    setEtape("saisie");
    setStatutCourse("acceptee");
    setConfirme(false);
    setChauffeur(null);
    setDiscussion(false);
    setDemandeId(null);
    setEcheance(null);
    setErreur(null);
    onClose();
  }

  /* Realtime : suivre les changements de statut de la demande */
  useEffect(() => {
    if (!["recherche", "acceptee", "course"].includes(etape) || !demandeId) return;

    const supabase = createClient();
    const canal = supabase
      .channel(`taxi-commande-${demandeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "taxi_requests",
          filter: `id=eq.${demandeId}`,
        },
        (payload) => {
          const ligne = payload.new as {
            status?: string;
            driver_id?: string | null;
          };
          if (ligne.status === "acceptee" && ligne.driver_id && etape === "recherche") {
            setEtape("acceptee");
            setStatutCourse("acceptee");
            void chargerChauffeur(ligne.driver_id);
          } else if (ligne.status && ["driver_arriving", "picked_up", "in_progress", "completed"].includes(ligne.status)) {
            setStatutCourse(ligne.status as StatutCourse);
            if (ligne.status === "completed") {
              setEtape("fin");
            }
          }
        },
      )
      .subscribe();

    canalRef.current = canal;
    return () => {
      canal.unsubscribe();
      canalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape, demandeId]);

  const chargerChauffeur = useCallback(async (driverId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("taxi_drivers")
      .select("id, display_name, phone, vehicle, plate")
      .eq("id", driverId)
      .maybeSingle();

    if (data) setChauffeur(data as ChauffeurAttribue);
  }, []);

  useEffect(() => {
    if (etape !== "recherche" || echeance === null) return;

    const timer = setInterval(() => {
      setTic((n) => n + 1);
      if (echeance <= Date.now()) {
        setEtape("fin");
        if (canalRef.current) canalRef.current.unsubscribe();
      }
    }, 1_000);

    return () => clearInterval(timer);
  }, [etape, echeance]);

  function envoyer() {
    if (!clientId || !depart) return;
    if (destinationType === "zone" && (!origine || !arrivee)) return;
    if (destinationType === "autre" && autre.trim().length < 2) return;

    setErreur(null);
    setEtape("envoi");

    const prix = budget.trim() === "" ? null : Number(budget.trim());

    startTransition(async () => {
      const resultat = await creerDemandeMatching({
        pickupLat: depart.lat,
        pickupLng: depart.lng,
        pickupLabel: departNom ?? null,
        destinationType,
        originZone: destinationType === "zone" ? origine : null,
        destinationZone: destinationType === "zone" ? arrivee : null,
        destinationName: destinationType === "autre" ? autre : null,
        proposedPrice: Number.isFinite(prix as number) ? prix : null,
        seats: sieges,
      });

      if (!resultat.ok) {
        setEtape("saisie");
        setErreur(resultat.error);
        return;
      }

      setDemandeId(resultat.data.id);
      setEcheance(Date.parse(resultat.data.expiresAt));
      setEtape("recherche");
    });
  }

  function refaire() {
    setEtape("saisie");
    setDemandeId(null);
    setEcheance(null);
    setErreur(null);
    setConfirme(false);
    setChauffeur(null);
    setStatutCourse("acceptee");
  }

  function confirmer() {
    const id = demandeId;
    if (!id || confirme) return;
    startTransition(async () => {
      const resultat = await confirmerCourse(id);
      if (resultat.ok) setConfirme(true);
      else setErreur(resultat.error);
    });
  }

  const nomArrivee =
    destinationType === "zone"
      ? nomZone(arrivee, locale)
      : autre.trim() || null;

  const secondes =
    echeance === null ? 0 : Math.max(0, Math.round((echeance - Date.now()) / 1000));

  const labelStatutCourse: Record<StatutCourse, string> = {
    acceptee: t.taxi.orderConfirmed,
    driver_arriving: t.taxi.courseDriverArriving ?? "Chauffeur en route",
    picked_up: t.taxi.coursePickedUp ?? "Passager pris en charge",
    in_progress: t.taxi.courseInProgress ?? "En route",
    completed: t.taxi.courseCompleted ?? "Course terminée",
  };

  const iconStatutCourse: Record<StatutCourse, string> = {
    acceptee: "✅",
    driver_arriving: "🚗",
    picked_up: "🤝",
    in_progress: "🚕",
    completed: "🏁",
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[900] flex items-end justify-center bg-[rgba(20,14,26,0.45)] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={t.taxi.orderTitle}
            className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[22px] bg-[var(--color-surface-solid)] shadow-[0_-12px_40px_rgba(20,14,26,0.25)] sm:rounded-[22px]"
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.96 }}
            transition={SPRING}
          >
            {/* Onglet fermeture */}
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <span aria-hidden className="mx-auto h-[4px] w-9 flex-none rounded-full bg-[var(--color-hairline)]" />
              <button
                type="button"
                onClick={fermer}
                className="press -ms-4 -mt-1 flex-none rounded-full p-2 text-[0.625rem] font-bold text-[var(--color-muted)]"
              >
                {t.taxi.orderClose}
              </button>
            </div>

            <div className="no-sb flex flex-col gap-3 overflow-y-auto px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <AnimatePresence mode="wait">
                {(etape === "saisie" || etape === "envoi") && (
                  <m.div
                    key="saisie"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-3"
                  >
                    {/* ─── La saisie ─────────────────────────────────── */}
                    <h2 className="flex items-center gap-2 text-[1.0625rem] font-bold tracking-[-0.01em] text-[var(--color-ink)]">
                      <span aria-hidden>🚕</span> {t.taxi.orderTitle}
                    </h2>

                    <div className="flex flex-col gap-2 rounded-[16px] bg-[var(--color-field)] px-3 py-[11px]">
                      <p className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
                        📍 {t.taxi.departure}
                      </p>
                      <p className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
                        {departNom ?? t.taxi.myPosition}
                      </p>
                      {!depart && (
                        <p className="text-[0.59375rem] text-[var(--color-muted)]">
                          {t.taxi.locationRefused}
                        </p>
                      )}
                    </div>

                    {/* Zone de départ */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
                        {t.taxi.orderOriginZoneLabel}
                      </p>
                      <div className="flex flex-wrap gap-[6px]">
                        {ZONES_TAXI.map((zone, i) => (
                          <m.button
                            key={zone.id}
                            type="button"
                            onClick={() => setOrigine(zone.id)}
                            aria-pressed={origine === zone.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.2 }}
                            className={cx(
                              "press rounded-full border px-[11px] py-[7px] text-[0.625rem] font-bold",
                              origine === zone.id
                                ? "border-[var(--color-brand-fill)] bg-[var(--color-brand-tint,rgba(131,56,228,0.1))] text-[var(--color-brand)]"
                                : "border-[var(--color-outline)] text-[var(--color-muted)]",
                            )}
                          >
                            {nomZone(zone.id, locale)}
                          </m.button>
                        ))}
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
                        🎯 {t.taxi.orderWhere}
                      </p>
                      <div className="flex flex-wrap gap-[6px]">
                        {ZONES_TAXI.map((zone, i) => (
                          <m.button
                            key={zone.id}
                            type="button"
                            onClick={() => {
                              setDestinationType("zone");
                              setArrivee(zone.id);
                            }}
                            aria-pressed={destinationType === "zone" && arrivee === zone.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.03, duration: 0.2 }}
                            className={cx(
                              "press rounded-full border px-[11px] py-[7px] text-[0.625rem] font-bold",
                              destinationType === "zone" && arrivee === zone.id
                                ? "border-[var(--color-brand-fill)] bg-[var(--color-brand-tint,rgba(131,56,228,0.1))] text-[var(--color-brand)]"
                                : "border-[var(--color-outline)] text-[var(--color-muted)]",
                            )}
                          >
                            {nomZone(zone.id, locale)}
                          </m.button>
                        ))}

                        <m.button
                          type="button"
                          onClick={() => setDestinationType("autre")}
                          aria-pressed={destinationType === "autre"}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + ZONES_TAXI.length * 0.03, duration: 0.2 }}
                          className={cx(
                            "press rounded-full border px-[11px] py-[7px] text-[0.625rem] font-bold",
                            destinationType === "autre"
                              ? "border-[var(--color-brand-fill)] bg-[var(--color-brand-tint,rgba(131,56,228,0.1))] text-[var(--color-brand)]"
                              : "border-[var(--color-outline)] text-[var(--color-muted)]",
                          )}
                        >
                          {t.taxi.orderAutre}
                        </m.button>
                      </div>

                      <AnimatePresence>
                        {destinationType === "autre" && (
                          <m.input
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            autoFocus
                            value={autre}
                            onChange={(e) => setAutre(e.target.value)}
                            placeholder={t.taxi.orderOtherHint}
                            className="w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-2 text-[0.75rem] font-bold text-[var(--color-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--color-faint)]"
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Budget + passagers */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 rounded-[14px] bg-[var(--color-field)] px-3 py-[9px]">
                        <span className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
                          💰 {t.taxi.orderBudget}
                        </span>
                        <span className="flex items-center gap-1">
                          <input
                            value={budget}
                            onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
                            inputMode="numeric"
                            placeholder="8"
                            aria-label={t.taxi.orderBudget}
                            className="w-full min-w-0 bg-transparent text-[0.875rem] font-bold text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
                          />
                          <span className="flex-none text-[0.65625rem] font-bold text-[var(--color-muted)]">
                            {t.taxi.orderDt}
                          </span>
                        </span>
                        <span className="text-[0.53125rem] text-[var(--color-faint)]">
                          {t.taxi.orderBudgetHint}
                        </span>
                      </label>

                      <div className="flex flex-col gap-1 rounded-[14px] bg-[var(--color-field)] px-3 py-[9px]">
                        <span className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
                          👥 {t.taxi.orderPassengers}
                        </span>
                        <span className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setSieges((n) => Math.max(1, n - 1))}
                            disabled={sieges <= 1}
                            aria-label="−"
                            className="press flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[0.875rem] font-bold text-[var(--color-ink)] disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-[22px] text-center text-[0.875rem] font-bold tabular-nums text-[var(--color-ink)]">
                            {sieges}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSieges((n) => Math.min(8, n + 1))}
                            disabled={sieges >= 8}
                            aria-label="+"
                            className="press flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[0.875rem] font-bold text-[var(--color-ink)] disabled:opacity-40"
                          >
                            +
                          </button>
                        </span>
                      </div>
                    </div>

                    {erreur && (
                      <p role="alert" className="px-1 text-[0.65625rem] font-semibold text-[var(--color-live)]">
                        {erreur}
                      </p>
                    )}

                    <m.button
                      type="button"
                      onClick={envoyer}
                      disabled={
                        pending ||
                        etape === "envoi" ||
                        !clientId ||
                        !depart ||
                        (destinationType === "zone" && (!origine || !arrivee)) ||
                        (destinationType === "autre" && autre.trim().length < 2)
                      }
                      whileTap={{ scale: 0.97 }}
                      className="press w-full rounded-full bg-[var(--color-brand-fill)] py-[13px] text-[0.8125rem] font-bold text-white shadow-[0_6px_18px_rgba(131,56,228,0.28)] disabled:opacity-50"
                    >
                      {etape === "envoi" ? t.taxi.orderSearching : t.taxi.orderSearch}
                    </m.button>

                    {!clientId && (
                      <a
                        href="/connexion?suite=/taxi"
                        className="press -mt-1 text-center text-[0.625rem] font-bold text-[var(--color-brand)]"
                      >
                        {t.taxi.chatSignIn}
                      </a>
                    )}
                  </m.div>
                )}

                {/* ─── Recherche avec overlay premium ──────────────── */}
                {etape === "recherche" && (
                  <m.div
                    key="recherche"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={SPRING}
                    className="flex flex-col items-center gap-4 py-6 text-center"
                  >
                    {/* Icône taxi animée */}
                    <m.div
                      animate={{
                        x: [0, -8, 8, -4, 4, 0],
                        rotate: [0, -3, 3, -1, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--color-brand-tint,rgba(131,56,228,0.12))]"
                    >
                      <span className="text-[2rem]">🚕</span>
                      <m.span
                        aria-hidden
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-brand-fill)]"
                      />
                    </m.div>

                    <m.h3
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-[0.9375rem] font-bold text-[var(--color-ink)]"
                    >
                      {t.taxi.orderSearching}
                    </m.h3>

                    <m.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="flex w-full max-w-[300px] flex-col gap-1 rounded-[14px] bg-[var(--color-field)] px-3 py-2 text-[0.65625rem]"
                    >
                      <p className="truncate font-semibold text-[var(--color-ink)]">
                        <span className="text-[var(--color-muted)]">📍 </span>
                        {departNom ?? t.taxi.myPosition}
                        <span className="mx-1 text-[var(--color-faint)]">→</span>
                        <span className="text-[var(--color-brand)]">🎯 {nomArrivee}</span>
                      </p>
                      <p className="truncate text-[var(--color-muted)]">
                        {budget.trim() !== "" && (
                          <>
                            💰 {format(t.taxi.orderProposed, { n: budget.trim() })}
                            <span className="mx-1 text-[var(--color-faint)]">·</span>
                          </>
                        )}
                        👥 {sieges} — {t.taxi.expiresIn.replace("{s}", String(secondes))}
                      </p>
                    </m.div>

                    <m.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="max-w-[300px] text-[0.59375rem] leading-[1.5] text-[var(--color-faint)]"
                    >
                      {t.taxi.orderNoDriverYet}
                    </m.p>

                    {/* Barre de progression animée */}
                    <div className="h-[3px] w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--color-field)]">
                      <m.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="h-full w-1/2 rounded-full bg-[var(--color-brand-fill)]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (demandeId) void annulerDemandeDiffusee(demandeId);
                        setEtape("saisie");
                        setDemandeId(null);
                        setEcheance(null);
                      }}
                      disabled={pending}
                      className="press rounded-full px-5 py-2 text-[0.65625rem] font-bold text-[var(--color-muted)] disabled:opacity-50"
                    >
                      {t.taxi.orderCancelSearch}
                    </button>
                  </m.div>
                )}

                {/* ─── Chauffeur trouvé + course active ────────────── */}
                {(etape === "acceptee" || etape === "course") && chauffeur && (
                  <m.div
                    key="acceptee"
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    transition={SPRING}
                    className="flex flex-col gap-3 py-1"
                  >
                    {/* Bannière statut */}
                    <m.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3 rounded-[18px] bg-[rgba(47,125,93,0.1)] px-4 py-3"
                    >
                      <span aria-hidden className="text-[1.5rem]">
                        {iconStatutCourse[statutCourse]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.8125rem] font-bold text-[var(--color-ok,#2f7d5d)]">
                          {labelStatutCourse[statutCourse]}
                        </p>
                        <p className="text-[0.65625rem] font-semibold text-[var(--color-ink)]">
                          {nomZone(origine, locale) ?? departNom ?? t.taxi.myPosition}
                          <span className="mx-1 text-[var(--color-faint)]">→</span>
                          {nomArrivee}
                        </p>
                      </div>
                    </m.div>

                    {/* Carte chauffeur */}
                    <m.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center gap-3 rounded-[16px] bg-[var(--color-field)] px-3 py-[11px]"
                    >
                      <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full bg-[var(--color-ink)] text-[0.8125rem] font-bold text-[var(--color-app)]">
                        {chauffeur.display_name?.slice(0, 1) ?? "🚕"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-bold text-[var(--color-ink)]">
                          {chauffeur.display_name}
                        </p>
                        <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                          {[chauffeur.vehicle, chauffeur.plate].filter(Boolean).join(" · ") || t.taxi.noSeatsInfo}
                        </p>
                      </div>
                      {budget.trim() !== "" && (
                        <span className="flex-none rounded-full bg-[var(--color-surface-solid)] px-[9px] py-[4px] text-[0.625rem] font-bold text-[var(--color-brand)]">
                          {format(t.taxi.orderAcceptedPrice, { n: budget.trim() })}
                        </span>
                      )}
                    </m.div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${chauffeur.phone}`}
                        className="press flex items-center justify-center gap-1 rounded-full bg-[var(--color-field)] py-[11px] text-[0.75rem] font-bold text-[var(--color-ink)]"
                      >
                        📞 {t.taxi.call}
                      </a>
                      <button
                        type="button"
                        onClick={() => setDiscussion((v) => !v)}
                        aria-pressed={discussion}
                        className="press flex items-center justify-center gap-1 rounded-full bg-[var(--color-field)] py-[11px] text-[0.75rem] font-bold text-[var(--color-ink)]"
                      >
                        💬 {t.taxi.discuss}
                      </button>
                    </div>

                    {/* Chat intégré */}
                    <AnimatePresence>
                      {discussion && (
                        <m.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <DriverChat
                            driverId={chauffeur.id}
                            driverName={chauffeur.display_name}
                            clientId={clientId}
                            destination={nomArrivee}
                            onClose={() => setDiscussion(false)}
                          />
                        </m.div>
                      )}
                    </AnimatePresence>

                    {/* Bouton principal selon le statut */}
                    {statutCourse === "acceptee" && !confirme && (
                      <m.button
                        type="button"
                        onClick={confirmer}
                        disabled={pending}
                        whileTap={{ scale: 0.97 }}
                        className="press w-full rounded-full bg-[var(--color-brand-fill)] py-[13px] text-[0.8125rem] font-bold text-white shadow-[0_6px_18px_rgba(131,56,228,0.28)] disabled:opacity-60"
                      >
                        🚕 {t.taxi.orderConfirm}
                      </m.button>
                    )}

                    {confirme && statutCourse === "acceptee" && (
                      <div className="flex items-center justify-center gap-2 rounded-full bg-[rgba(47,125,93,0.1)] py-[11px] text-[0.8125rem] font-bold text-[var(--color-ok,#2f7d5d)]">
                        ✓ {t.taxi.orderConfirmed}
                      </div>
                    )}

                    {erreur && (
                      <p role="alert" className="px-1 text-center text-[0.65625rem] font-semibold text-[var(--color-live)]">
                        {erreur}
                      </p>
                    )}
                  </m.div>
                )}

                {/* ─── Fin ────────────────────────────────────────── */}
                {etape === "fin" && (
                  <m.div
                    key="fin"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={SPRING}
                    className="flex flex-col items-center gap-3 py-6 text-center"
                  >
                    <span aria-hidden className="text-[1.375rem]">
                      {statutCourse === "completed" ? "🏁" : "🕐"}
                    </span>
                    <h3 className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
                      {statutCourse === "completed"
                        ? (t.taxi.courseCompleted ?? "Course terminée !")
                        : t.taxi.orderExpired}
                    </h3>
                    <m.button
                      type="button"
                      onClick={refaire}
                      whileTap={{ scale: 0.97 }}
                      className="press w-full max-w-[240px] rounded-full bg-[var(--color-brand-fill)] py-[12px] text-[0.75rem] font-bold text-white"
                    >
                      {t.taxi.requestRide}
                    </m.button>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
