"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantDriverAccess, revokeDriverAccess, setDriverApproval } from "@/app/actions/taxi";
import { Button, Card, Tag, fieldClass } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { presenceDe } from "@/lib/taxi-presence";
import { timeAgo } from "@/lib/format";

export interface AdminDriver {
  id: string;
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_approved: boolean;
  is_available: boolean;
  /* Ajoutées par la migration de présence, d'où l'optionnel : `presenceDe`
     retombe sur `is_available` tant que le DDL n'est pas collé. */
  status?: string | null;
  seats_free?: number | null;
  lat?: number | null;
  lng?: number | null;
  position_updated_at?: string | null;
  heading_lat?: number | null;
  heading_lng?: number | null;
}

/** Une ligne de chauffeur, approuvable ou révocable. */
export function DriverRow({ driver }: { driver: AdminDriver }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setDriverApproval(driver.id, !driver.is_approved);
      router.refresh();
    });
  }

  const presence = presenceDe(driver);

  /*
    Une ligne d'état honnête, y compris dans ce qu'elle ne sait pas.

    « Position inconnue » est une information ; une position affichée sans son
    âge en serait une fausse. Un chauffeur peut être parfaitement disponible et
    n'avoir jamais autorisé le GPS — l'écran doit pouvoir le dire sans le faire
    passer pour absent.
  */
  const etat = [
    presence.statut === "libre"
      ? "libre"
      : presence.statut === "places"
        ? presence.places === null
          ? "des places"
          : `${presence.places} place(s)`
        : presence.statut === "occupe"
          ? "occupé"
          : "hors ligne",
    presence.positionConnue && driver.position_updated_at
      ? `position ${timeAgo(driver.position_updated_at)}`
      : "position inconnue",
    driver.heading_lat != null && driver.heading_lng != null ? "destination déclarée" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex items-center gap-[10px] p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
          {driver.display_name}
        </p>
        <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
          {driver.phone}
          {driver.vehicle && ` · ${driver.vehicle}`}
          {driver.plate && ` · ${driver.plate}`}
        </p>

        {/*
          Ce que l'administration ne voyait pas.

          Un chauffeur approuvé n'était qu'un nom et un numéro ; impossible de
          savoir, depuis cet écran, s'il travaillait, où il se trouvait, ni s'il
          restait des places dans sa voiture. C'est pourtant la première question
          qu'on se pose quand un client appelle pour se plaindre de n'avoir
          trouvé personne.
        */}
        <p className="truncate text-[0.5625rem] text-[var(--color-faint)]">{etat}</p>
      </div>

      <Tag tone={driver.is_approved ? "tinted" : "live"}>
        {driver.is_approved ? "approuvé" : "à vérifier"}
      </Tag>

      <Button
        tone={driver.is_approved ? "outline" : "primary"}
        onClick={toggle}
        disabled={pending}
        className="flex-none"
      >
        {pending ? "…" : driver.is_approved ? "Révoquer" : "Approuver"}
      </Button>

      <Button
        tone="ghost"
        onClick={() =>
          startTransition(async () => {
            await revokeDriverAccess(driver.id);
            router.refresh();
          })
        }
        disabled={pending}
        className="flex-none"
      >
        Retirer
      </Button>
    </Card>
  );
}

const FIELD =
  fieldClass({ size: "sm", solid: true });

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

/**
 * Ouvrir l'espace chauffeur à un membre.
 *
 * Un membre qui conduit un taxi contacte l'administration ; c'est ici qu'on lui
 * ouvre la porte. Il ne peut pas se l'ouvrir lui-même, et tant qu'elle est
 * fermée le lien n'apparaît nulle part chez lui.
 *
 * Le téléphone est demandé ici parce que la fiche en exige un et que beaucoup de
 * profils n'en portent pas : bloquer l'ouverture pour cette seule raison
 * obligerait l'administration à faire modifier le profil avant de revenir.
 */
export function GrantDriver() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function search() {
    setError(null);
    const term = query.trim();
    if (term.length < 2) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone")
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(8);

    setMembers(data ?? []);
    if ((data ?? []).length === 0) setError("Aucun membre ne correspond.");
  }

  function grant(member: Member) {
    const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
    const phone = phones[member.id] ?? member.phone ?? "";

    startTransition(async () => {
      const result = await grantDriverAccess({
        profileId: member.id,
        displayName: name || "Chauffeur",
        phone,
      });
      if (!result.ok) return setError(result.error);

      setMembers([]);
      setQuery("");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-[10px] p-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Nom ou téléphone du membre"
          className={FIELD}
        />
        <Button type="button" onClick={() => void search()} className="flex-none">
          Chercher
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[0.71875rem] text-[var(--color-ink)]">
            {[member.first_name, member.last_name].filter(Boolean).join(" ") || "Sans nom"}
          </span>

          <input
            value={phones[member.id] ?? member.phone ?? ""}
            onChange={(e) => setPhones((p) => ({ ...p, [member.id]: e.target.value }))}
            inputMode="tel"
            placeholder="Téléphone"
            className={`${FIELD} w-[130px] flex-none`}
          />

          <Button type="button" onClick={() => grant(member)} disabled={pending} className="flex-none">
            {pending ? "…" : "Autoriser"}
          </Button>
        </div>
      ))}
    </Card>
  );
}
