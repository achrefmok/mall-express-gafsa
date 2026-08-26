"use client";

import { m } from "framer-motion";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { annulerDemande, demanderCourse } from "@/app/actions/taxi-course";
import { usePoll } from "@/lib/use-poll";
import { cx } from "@/lib/format";
import type { Presence } from "@/lib/taxi-presence";
import type { Point } from "@/lib/taxi-match";

/**
 * Demander une course, et attendre la réponse.
 *
 * L'écran ne proposait jusqu'ici que d'appeler ou d'écrire. Les deux supposent
 * que le chauffeur est disponible pour parler — au volant, il ne l'est pas. Une
 * demande, elle, fait sonner son téléphone application fermée, lui montre qui,
 * d'où, vers où, et se répond d'un doigt.
 *
 * L'attente est bornée et visible. Trois minutes, décomptées à l'écran : passé
 * ce délai la demande meurt d'elle-même, côté serveur, et le client sait qu'il
 * doit en essayer un autre plutôt que de fixer un bouton qui ne bougera plus.
 */

type Etat = "repos" | "envoi" | "attente" | "acceptee" | "refusee" | "expiree";

export function RideRequest({
  driverId,
  clientId,
  depart,
  departNom,
  destination,
  destinationNom,
  presence,
}: {
  driverId: string;
  /** Absent : personne n'est connecté, on ne peut pas demander de course. */
  clientId: string | null;
  depart: Point | null;
  departNom: string | null;
  destination: Point | null;
  destinationNom: string | null;
  presence: Presence;
}) {
  const { t } = useI18n();

  const [etat, setEtat] = useState<Etat>("repos");
  const [demandeId, setDemandeId] = useState<string | null>(null);
  const [echeance, setEcheance] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /* Fait battre le compte à rebours sans solliciter la base. */
  const [, setTic] = useState(0);

  /* Changer de chauffeur remet le bloc à zéro : la demande précédente
     concernait quelqu'un d'autre, et son résultat n'a rien à dire ici. */
  useEffect(() => {
    setEtat("repos");
    setDemandeId(null);
    setEcheance(null);
    setErreur(null);
  }, [driverId]);

  /*
    Guetter la réponse.

    Le chauffeur répond depuis son propre téléphone : rien n'en informe ce
    navigateur, sinon la relecture. Quatre secondes — c'est le temps pendant
    lequel quelqu'un accepte de regarder un bouton sans se demander si l'écran a
    planté.
  */
  const relire = useCallback(async () => {
    if (!demandeId || etat !== "attente") return;

    const supabase = createClient();
    const { data } = await supabase
      .from("taxi_requests")
      .select("status, expires_at")
      .eq("id", demandeId)
      .maybeSingle();

    if (!data) return false;

    if (data.status === "acceptee") setEtat("acceptee");
    else if (data.status === "refusee") setEtat("refusee");
    else if (data.status === "expiree") setEtat("expiree");
    // L'échéance fait foi même si le serveur n'a pas encore entériné : le
    // nettoyage périodique passe bien après la mort de la demande.
    else if (Date.parse(data.expires_at) <= Date.now()) setEtat("expiree");
  }, [demandeId, etat]);

  usePoll(relire, 4_000);

  useEffect(() => {
    if (etat !== "attente" || echeance === null) return;

    const timer = setInterval(() => {
      setTic((n) => n + 1);
      if (echeance <= Date.now()) setEtat("expiree");
    }, 1_000);

    return () => clearInterval(timer);
  }, [etat, echeance]);

  function envoyer() {
    if (!clientId || !depart) return;

    setErreur(null);
    setEtat("envoi");

    startTransition(async () => {
      const result = await demanderCourse({
        driverId,
        pickupLat: depart.lat,
        pickupLng: depart.lng,
        pickupLabel: departNom,
        destLat: destination?.lat ?? null,
        destLng: destination?.lng ?? null,
        destLabel: destinationNom,
      });

      if (!result.ok) {
        setEtat("repos");
        setErreur(result.error);
        return;
      }

      setDemandeId(result.data.id);
      setEcheance(Date.parse(result.data.expiresAt));
      setEtat("attente");
    });
  }

  function annuler() {
    const id = demandeId;
    setEtat("repos");
    setDemandeId(null);
    setEcheance(null);
    if (id) startTransition(async () => void (await annulerDemande(id)));
  }

  /*
    Le bloc ne s'affiche pas quand il ne servirait à rien.

    Sans point de départ, la demande n'aurait aucun sens — le chauffeur ne
    saurait pas où venir. Chez un chauffeur occupé, elle serait refusée par le
    serveur : mieux vaut ne pas proposer un bouton dont on sait qu'il échouera.
  */
  if (!clientId || !depart || !presence.joignable) return null;

  const secondes =
    echeance === null ? 0 : Math.max(0, Math.round((echeance - Date.now()) / 1000));

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-[6px]"
    >
      {etat === "repos" || etat === "envoi" ? (
        <button
          type="button"
          onClick={envoyer}
          disabled={pending || etat === "envoi"}
          className="press w-full rounded-full bg-[var(--color-brand-fill)] py-[11px] text-[0.6875rem] font-bold text-white disabled:opacity-60"
        >
          {etat === "envoi" ? t.taxi.requestSending : t.taxi.requestRide}
        </button>
      ) : etat === "attente" ? (
        <div className="flex items-center gap-2 rounded-full bg-[var(--color-field)] py-[9px] pe-[9px] ps-[13px]">
          {/* Un point qui bat : la demande est partie, elle vit, on attend. */}
          <m.span
            aria-hidden
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-[6px] w-[6px] flex-none rounded-full bg-[var(--color-brand-fill)]"
          />

          <span className="min-w-0 flex-1 truncate text-[0.625rem] font-semibold text-[var(--color-ink)]">
            {t.taxi.requestPending}
          </span>

          <span className="flex-none text-[0.5625rem] tabular-nums text-[var(--color-muted)]">
            {t.taxi.expiresIn.replace("{s}", String(secondes))}
          </span>

          <button
            type="button"
            onClick={annuler}
            className="press flex-none rounded-full px-[9px] py-[4px] text-[0.5625rem] font-bold text-[var(--color-muted)]"
          >
            {t.taxi.requestCancel}
          </button>
        </div>
      ) : (
        <div
          className={cx(
            "flex items-center gap-2 rounded-full px-[13px] py-[10px] text-[0.625rem] font-bold",
            etat === "acceptee"
              ? "bg-[rgba(47,125,93,0.12)] text-[var(--color-ok,#2f7d5d)]"
              : "bg-[var(--color-field)] text-[var(--color-muted)]",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {etat === "acceptee"
              ? t.taxi.requestAccepted
              : etat === "refusee"
                ? t.taxi.requestRefused
                : t.taxi.requestExpired}
          </span>

          {/* Après un refus ou un silence, on peut redemander — au même
              chauffeur s'il s'est libéré, sinon la liste est juste au-dessus. */}
          {etat !== "acceptee" && (
            <button
              type="button"
              onClick={() => {
                setEtat("repos");
                setDemandeId(null);
              }}
              className="press flex-none text-[0.5625rem] font-bold underline underline-offset-2"
            >
              {t.taxi.requestRide}
            </button>
          )}
        </div>
      )}

      {erreur && (
        <p role="alert" className="px-2 text-[0.5625rem] font-semibold text-[var(--color-live)]">
          {erreur}
        </p>
      )}
    </m.div>
  );
}
