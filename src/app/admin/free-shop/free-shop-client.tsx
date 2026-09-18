"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { modererPublication, deleteDeal } from "@/app/actions/deals";
import { cx, formatPrice, timeAgo } from "@/lib/format";
import { Button, Card, Chip, EmptyState, Tag, fieldClass } from "@/components/ui/primitives";
import type { AppLocale, DealStatus, ModerationStatus } from "@/types/database";

export interface PublicationAModerer {
  id: string;
  title: string;
  body: string | null;
  body_ar: string | null;
  images: string[];
  price: number | null;
  phone: string | null;
  whatsapp: string | null;
  location_label: string | null;
  status: DealStatus;
  moderation: ModerationStatus;
  rejection_reason: string | null;
  created_at: string;
  expires_at: string;
  author: { id: string; first_name: string | null; last_name: string | null; phone: string | null } | null;
  category: { name_fr: string; name_ar: string; hue: number } | null;
  shop: { name: string; slug: string } | null;
}

const ONGLETS: Array<{ cle: ModerationStatus; libelle: string }> = [
  { cle: "pending", libelle: "En attente" },
  { cle: "approved", libelle: "Approuvées" },
  { cle: "rejected", libelle: "Refusées" },
];

/**
 * La file de modération.
 *
 * Trois onglets, et le nombre en attente porté par le premier : c'est le seul
 * chiffre qui demande une action, les deux autres sont des archives.
 *
 * Un refus exige son motif. Le champ s'ouvre au moment du refus plutôt que de
 * traîner sous chaque ligne : sur trente publications, trente champs vides
 * font un mur, et l'œil ne trouve plus les boutons.
 */
export function FreeShopModeration({
  publications,
  locale,
}: {
  publications: PublicationAModerer[];
  locale: AppLocale;
}) {
  const [onglet, setOnglet] = useState<ModerationStatus>("pending");

  const parOnglet = useMemo(
    () => publications.filter((p) => p.moderation === onglet),
    [publications, onglet],
  );

  const enAttente = publications.filter((p) => p.moderation === "pending").length;

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      <div className="no-sb flex flex-none gap-2 overflow-x-auto">
        {ONGLETS.map((o) => (
          <Chip key={o.cle} active={onglet === o.cle} onClick={() => setOnglet(o.cle)}>
            {o.libelle}
            {o.cle === "pending" && enAttente > 0 ? ` · ${enAttente}` : ""}
          </Chip>
        ))}
      </div>

      {parOnglet.length === 0 ? (
        <EmptyState title="Rien ici" body="Aucune publication dans cet état." />
      ) : (
        parOnglet.map((p) => <LignePublication key={p.id} publication={p} locale={locale} />)
      )}
    </div>
  );
}

function LignePublication({
  publication: p,
  locale,
}: {
  publication: PublicationAModerer;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [motif, setMotif] = useState("");
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const auteur = [p.author?.first_name, p.author?.last_name].filter(Boolean).join(" ") || "Membre";
  const corps = locale === "ar" ? (p.body_ar ?? p.body) : (p.body ?? p.body_ar);

  function decider(decision: "approved" | "rejected") {
    setErreur(null);
    startTransition(async () => {
      const r = await modererPublication(p.id, decision, decision === "rejected" ? motif : undefined);
      if (r.ok) {
        setRefusOuvert(false);
        router.refresh();
      } else setErreur(r.error);
    });
  }

  function supprimer() {
    setErreur(null);
    startTransition(async () => {
      const r = await deleteDeal(p.id);
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-[10px] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.78125rem] font-bold text-[var(--color-ink)]">{p.title}</p>
          <p className="text-[0.625rem] text-[var(--color-muted)]">
            {auteur}
            {p.author?.phone ? ` · ${p.author.phone}` : ""} · {timeAgo(p.created_at, locale)}
          </p>
        </div>

        {p.price != null && (
          <span dir="ltr" className="flex-none text-[0.78125rem] font-bold text-[var(--color-brand)]">
            {formatPrice(p.price, locale)}
          </span>
        )}
      </div>

      {corps && (
        <p className="line-clamp-3 text-[0.6875rem] leading-[1.5] text-[var(--color-muted)]">{corps}</p>
      )}

      {p.images.length > 0 && (
        <div className="no-sb flex gap-2 overflow-x-auto">
          {p.images.map((url) => (
            /* eslint-disable-next-line @next/next/no-img-element -- miniature de modération */
            <img key={url} src={url} alt="" className="h-16 w-16 flex-none rounded-[12px] object-cover" />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-[6px] text-[0.59375rem]">
        <Tag>{p.images.length} photo{p.images.length > 1 ? "s" : ""}</Tag>
        {p.category && <Tag>{locale === "ar" ? p.category.name_ar : p.category.name_fr}</Tag>}
        {p.shop && <Tag>{p.shop.name}</Tag>}
        {p.location_label && <Tag>{p.location_label}</Tag>}
        {p.phone && <Tag>☎ {p.phone}</Tag>}
        {p.whatsapp && <Tag>WhatsApp {p.whatsapp}</Tag>}
      </div>

      {p.moderation === "rejected" && p.rejection_reason && (
        <p className="rounded-[10px] bg-[rgba(224,85,111,0.1)] px-[10px] py-[6px] text-[0.625rem] text-[var(--color-live)]">
          {t.deals.rejectionReason} : {p.rejection_reason}
        </p>
      )}

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      {refusOuvert ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Pourquoi ce refus ? Le membre le lira."
            className={cx(fieldClass({ size: "sm", solid: true }), "resize-none")}
          />
          <div className="flex gap-2">
            <Button onClick={() => decider("rejected")} disabled={pending || !motif.trim()}>
              Confirmer le refus
            </Button>
            <Button onClick={() => setRefusOuvert(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {p.moderation !== "approved" && (
            <Button onClick={() => decider("approved")} disabled={pending}>
              Approuver
            </Button>
          )}
          {p.moderation !== "rejected" && (
            <Button onClick={() => setRefusOuvert(true)} disabled={pending}>
              Refuser
            </Button>
          )}
          <Button onClick={supprimer} disabled={pending}>
            {t.common.delete}
          </Button>
        </div>
      )}
    </Card>
  );
}
