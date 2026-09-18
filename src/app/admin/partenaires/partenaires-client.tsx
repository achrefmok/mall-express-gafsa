"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirPartenaire } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/format";
import { Button, Card, EmptyState, KeyValueRow, Switch, Tag, fieldClass } from "@/components/ui/primitives";
import type { AppLocale, ReservationStatus, ShopStatus } from "@/types/database";

const CHAMP = fieldClass({ size: "sm", solid: true });

export interface BoutiquePartenaire {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  status: ShopStatus;
  is_partner: boolean;
  partner_rank: number | null;
  partner_tagline: string | null;
  accepts_reservations: boolean;
}

export interface ReservationAdmin {
  id: string;
  full_name: string;
  phone: string;
  party_size: number;
  desired_at: string;
  status: ReservationStatus;
  created_at: string;
  shop: { name: string; slug: string } | null;
}

/**
 * Qui est partenaire, et ce que ça donne.
 *
 * Les partenaires en place sont dépliés, les autres boutiques réduites à une
 * ligne avec leur interrupteur : sur trois cents boutiques approuvées, tout
 * déplier ferait un écran qu'on ne parcourt pas. Ce qu'on vient vérifier ici,
 * c'est l'état des quelques partenaires — pas la liste du mall.
 */
export function PartenairesAdmin({
  boutiques,
  reservations,
  locale,
}: {
  boutiques: BoutiquePartenaire[];
  reservations: ReservationAdmin[];
  locale: AppLocale;
}) {
  const partenaires = boutiques.filter((b) => b.is_partner);
  const autres = boutiques.filter((b) => !b.is_partner);

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
        Partenaires ({partenaires.length})
      </p>

      {partenaires.length === 0 ? (
        <EmptyState
          title="Aucun partenaire"
          body="Activez une boutique ci-dessous pour la mettre en avant sur l'accueil."
        />
      ) : (
        partenaires.map((b) => <FichePartenaire key={b.id} boutique={b} deplie />)
      )}

      <p className="mt-2 text-[0.6875rem] font-bold text-[var(--color-ink)]">Les autres boutiques</p>
      {autres.map((b) => (
        <FichePartenaire key={b.id} boutique={b} />
      ))}

      <p className="mt-2 text-[0.6875rem] font-bold text-[var(--color-ink)]">
        Dernières réservations
      </p>
      {reservations.length === 0 ? (
        <EmptyState title="Aucune réservation" body="Rien n'a encore été demandé." />
      ) : (
        <Card className="flex flex-col gap-2 p-3">
          {reservations.map((r) => (
            <KeyValueRow
              key={r.id}
              label={
                <span className="text-[0.65625rem] text-[var(--color-muted)]">
                  {r.shop?.name ?? "—"} · {r.full_name}
                </span>
              }
            >
              <span dir="ltr" className="text-[0.625rem] text-[var(--color-muted)]">
                {formatDateTime(r.desired_at, locale)}
              </span>
              <Tag>{r.status}</Tag>
            </KeyValueRow>
          ))}
        </Card>
      )}
    </div>
  );
}

function FichePartenaire({ boutique, deplie }: { boutique: BoutiquePartenaire; deplie?: boolean }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(Boolean(deplie));
  const [rang, setRang] = useState(boutique.partner_rank?.toString() ?? "");
  const [accroche, setAccroche] = useState(boutique.partner_tagline ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enregistrer(isPartner: boolean) {
    setErreur(null);
    startTransition(async () => {
      const r = await definirPartenaire({
        shopId: boutique.id,
        isPartner,
        rank: rang.trim() ? Number(rang) : null,
        tagline: accroche,
      });
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-[10px] p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          className="min-w-0 flex-1 truncate text-start text-[0.75rem] font-bold text-[var(--color-ink)]"
        >
          {boutique.name}
        </button>

        {boutique.accepts_reservations && <Tag>réserve</Tag>}

        <Switch
          checked={boutique.is_partner}
          onChange={(v) => enregistrer(v)}
          label="Partenaire"
        />
      </div>

      {ouvert && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[0.625rem] text-[var(--color-muted)]">Accroche</span>
            <input
              value={accroche}
              onChange={(e) => setAccroche(e.target.value.slice(0, 80))}
              placeholder="Le poisson frais de Gafsa"
              className={CHAMP}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.625rem] text-[var(--color-muted)]">Ordre sur l&apos;accueil</span>
            <input
              value={rang}
              onChange={(e) => setRang(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              className={CHAMP}
            />
          </label>

          {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

          <div className="flex gap-2">
            <Button onClick={() => enregistrer(boutique.is_partner)} disabled={pending}>
              Enregistrer
            </Button>
            <Link
              href={`/boutique/${boutique.slug}`}
              className="rounded-full border border-[var(--color-outline)] px-3 py-[6px] text-[0.65625rem] font-bold text-[var(--color-ink)]"
            >
              Voir la fiche
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
