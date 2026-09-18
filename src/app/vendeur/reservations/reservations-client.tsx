"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { deciderReservation } from "@/app/actions/reservations";
import { cx, formatDateTime } from "@/lib/format";
import { telHref, whatsAppHref } from "@/lib/contact";
import { Button, Card, Chip, EmptyState, Tag, fieldClass } from "@/components/ui/primitives";
import type { AppLocale, ReservationStatus } from "@/types/database";

export interface ReservationVendeur {
  id: string;
  full_name: string;
  phone: string;
  party_size: number;
  desired_at: string;
  note: string | null;
  status: ReservationStatus;
  refusal_reason: string | null;
  created_at: string;
  handled_at: string | null;
  product: { name: string } | null;
}

const LIBELLES: Record<ReservationStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  done: "Honorée",
  cancelled: "Annulée",
};

const FILTRES: Array<{ cle: "pending" | "accepted" | "archives"; libelle: string }> = [
  { cle: "pending", libelle: "À répondre" },
  { cle: "accepted", libelle: "Acceptées" },
  { cle: "archives", libelle: "Archives" },
];

/**
 * La file des réservations.
 *
 * Trois filtres seulement. « Refusée », « honorée » et « annulée » finissent
 * ensemble dans les archives : ce sont trois façons d'en avoir fini, et leur
 * donner un onglet chacun aurait fait cinq onglets dont trois vides.
 *
 * Le numéro du client est un lien : la moitié des réponses se font par appel,
 * et recopier huit chiffres depuis un écran est le genre de friction qui fait
 * remettre à plus tard.
 */
export function ReservationsVendeur({
  reservations,
  locale,
}: {
  reservations: ReservationVendeur[];
  locale: AppLocale;
}) {
  const [filtre, setFiltre] = useState<"pending" | "accepted" | "archives">("pending");

  const visibles = useMemo(
    () =>
      reservations.filter((r) =>
        filtre === "archives" ? !["pending", "accepted"].includes(r.status) : r.status === filtre,
      ),
    [reservations, filtre],
  );

  const enAttente = reservations.filter((r) => r.status === "pending").length;

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      <div className="no-sb flex flex-none gap-2 overflow-x-auto">
        {FILTRES.map((f) => (
          <Chip key={f.cle} active={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
            {f.libelle}
            {f.cle === "pending" && enAttente > 0 ? ` · ${enAttente}` : ""}
          </Chip>
        ))}
      </div>

      {visibles.length === 0 ? (
        <EmptyState title="Rien ici" body="Aucune réservation dans cet état." />
      ) : (
        visibles.map((r) => <LigneReservation key={r.id} reservation={r} locale={locale} />)
      )}
    </div>
  );
}

function LigneReservation({
  reservation: r,
  locale,
}: {
  reservation: ReservationVendeur;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [motif, setMotif] = useState("");
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tel = telHref(r.phone);
  const wa = whatsAppHref(r.phone, `Bonjour ${r.full_name}, au sujet de votre réservation.`);

  function decider(decision: "accepted" | "refused" | "done") {
    setErreur(null);
    startTransition(async () => {
      const res = await deciderReservation(r.id, decision, decision === "refused" ? motif : undefined);
      if (res.ok) {
        setRefusOuvert(false);
        router.refresh();
      } else setErreur(res.error);
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-[10px] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.78125rem] font-bold text-[var(--color-ink)]">{r.full_name}</p>
          <p dir="ltr" className="text-[0.625rem] text-[var(--color-muted)]">
            {formatDateTime(r.desired_at, locale)} · {r.party_size} pers.
          </p>
        </div>
        <Tag>{LIBELLES[r.status]}</Tag>
      </div>

      {r.product && (
        <p className="text-[0.65625rem] text-[var(--color-muted)]">Pour : {r.product.name}</p>
      )}
      {r.note && (
        <p className="text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">« {r.note} »</p>
      )}
      {r.status === "refused" && r.refusal_reason && (
        <p className="rounded-[10px] bg-[rgba(224,85,111,0.1)] px-[10px] py-[6px] text-[0.625rem] text-[var(--color-live)]">
          {r.refusal_reason}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {tel && (
          <a
            href={tel}
            dir="ltr"
            className="rounded-full border border-[var(--color-outline)] px-3 py-[6px] text-[0.65625rem] font-bold text-[var(--color-ink)]"
          >
            ☎ {r.phone}
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-transparent bg-[#e6f4ea] px-3 py-[6px] text-[0.65625rem] font-bold text-[#0f7a3d]"
          >
            {t.common.whatsApp}
          </a>
        )}
      </div>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      {refusOuvert ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, 200))}
            rows={2}
            placeholder="Complet ce soir-là, fermé ce jour…"
            className={cx(fieldClass({ size: "sm", solid: true }), "resize-none")}
          />
          <div className="flex gap-2">
            <Button onClick={() => decider("refused")} disabled={pending}>
              Confirmer le refus
            </Button>
            <Button onClick={() => setRefusOuvert(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {r.status === "pending" && (
            <>
              <Button onClick={() => decider("accepted")} disabled={pending}>
                Accepter
              </Button>
              <Button onClick={() => setRefusOuvert(true)} disabled={pending}>
                Refuser
              </Button>
            </>
          )}
          {r.status === "accepted" && (
            <Button onClick={() => decider("done")} disabled={pending}>
              Marquer honorée
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
