"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { reserver } from "@/app/actions/reservations";
import { cx } from "@/lib/format";
import { Button, Card, fieldClass } from "@/components/ui/primitives";

const CHAMP = fieldClass({ size: "sm", solid: true });

const pad = (n: number) => String(n).padStart(2, "0");

/** Demain 19 h : l'heure qu'on réserve le plus souvent, et jamais dans le passé. */
function demainSoir(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Réserver chez un partenaire.
 *
 * Le formulaire ne s'ouvre qu'au toucher du bouton : déplié en permanence sur
 * la fiche d'une boutique, il pousse les produits sous la ligne de flottaison
 * pour un geste que neuf visiteurs sur dix ne feront pas.
 *
 * Le nom et le téléphone sont préremplis avec ce que le compte sait déjà. Une
 * réservation qu'il faut ressaisir entièrement est une réservation qu'on
 * abandonne — et le commerçant rappelle sur ce numéro, pas sur un autre.
 */
export function ReservationSheet({
  shopId,
  shopName,
  defaults,
  label,
}: {
  shopId: string;
  shopName: string;
  defaults: { fullName: string; phone: string };
  label: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [ouvert, setOuvert] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  const [nom, setNom] = useState(defaults.fullName);
  const [tel, setTel] = useState(defaults.phone);
  const [personnes, setPersonnes] = useState("2");
  const [quand, setQuand] = useState(demainSoir);
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await reserver({
        shopId,
        fullName: nom,
        phone: tel,
        partySize: Number(personnes) || 1,
        // datetime-local est en heure locale : on repasse en ISO.
        desiredAt: new Date(quand).toISOString(),
        note,
      });

      if (r.ok) {
        setEnvoyee(true);
        setOuvert(false);
        router.refresh();
      } else setErreur(r.error);
    });
  }

  if (envoyee) {
    return (
      <Card className="flex flex-col gap-1 border-[rgba(31,122,61,0.28)] bg-[rgba(230,244,234,0.6)] p-3">
        <p className="text-[0.71875rem] font-bold text-[#0f7a3d]">Demande envoyée</p>
        <p className="text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">
          {shopName} vous répond sur {tel}. Vous retrouverez la demande dans votre profil.
        </p>
      </Card>
    );
  }

  if (!ouvert) {
    return (
      <Button onClick={() => setOuvert(true)} className="w-full">
        {label}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-[10px] p-3">
      <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">{label}</p>

      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] text-[var(--color-muted)]">Votre nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] text-[var(--color-muted)]">Téléphone</span>
        <input
          value={tel}
          onChange={(e) => setTel(e.target.value.slice(0, 20))}
          inputMode="tel"
          dir="ltr"
          placeholder="20 000 000"
          className={CHAMP}
        />
      </label>

      <div className="grid grid-cols-[1fr_84px] gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] text-[var(--color-muted)]">Quand</span>
          <input
            type="datetime-local"
            value={quand}
            onChange={(e) => setQuand(e.target.value)}
            dir="ltr"
            className={CHAMP}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] text-[var(--color-muted)]">Personnes</span>
          <input
            value={personnes}
            onChange={(e) => setPersonnes(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            dir="ltr"
            className={CHAMP}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] text-[var(--color-muted)]">Précisions (facultatif)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          rows={2}
          placeholder="Une table près de la fenêtre, un anniversaire…"
          className={cx(CHAMP, "resize-none")}
        />
      </label>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <div className="flex gap-2">
        <Button onClick={envoyer} disabled={pending} className="flex-1">
          {pending ? t.common.loading : "Envoyer la demande"}
        </Button>
        <Button onClick={() => setOuvert(false)} disabled={pending}>
          {t.common.cancel}
        </Button>
      </div>
    </Card>
  );
}
