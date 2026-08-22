"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  grantProviderAccess,
  revokeProviderAccess,
  setProviderApproval,
} from "@/app/actions/sos";
import { SOS_TRADES, type SosTrade } from "@/lib/sos";
import { Button, Card, Tag, fieldClass } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

/*
  Les libellés des métiers, en français seulement.

  L'administration n'existe qu'en français dans tout le projet — les écrans
  d'administration ne passent pas par le dictionnaire. Les reprendre ici évite de
  faire dépendre un écran interne du provider d'internationalisation.
*/
const TRADE_LABELS: Record<SosTrade, string> = {
  mecanicien: "Mécanicien",
  electricien: "Électricien",
  plombier: "Plombier",
  remorquage: "Remorquage",
  transporteur: "Transporteur",
  serrurier: "Serrurier",
  pneumatique: "Pneumatique",
  climatisation: "Climatisation",
};

export interface AdminProvider {
  id: string;
  trade: SosTrade;
  display_name: string;
  phone: string;
  description: string | null;
  is_approved: boolean;
  is_available: boolean;
}

/** Une fiche de dépanneur, approuvable ou révocable. */
export function ProviderRow({ provider }: { provider: AdminProvider }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setProviderApproval(provider.id, !provider.is_approved);
      router.refresh();
    });
  }

  return (
    <Card className="flex items-center gap-[10px] p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
          {provider.display_name}
        </p>
        <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
          {TRADE_LABELS[provider.trade]} · {provider.phone}
          {provider.description && ` · ${provider.description}`}
        </p>
      </div>

      <Tag tone={provider.is_approved ? "tinted" : "live"}>
        {provider.is_approved ? "approuvé" : "à vérifier"}
      </Tag>

      <Button
        tone={provider.is_approved ? "outline" : "primary"}
        onClick={toggle}
        disabled={pending}
        className="flex-none"
      >
        {pending ? "…" : provider.is_approved ? "Révoquer" : "Approuver"}
      </Button>

      <Button
        tone="ghost"
        onClick={() =>
          startTransition(async () => {
            await revokeProviderAccess(provider.id);
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
 * Ouvrir l'espace dépanneur à un membre, pour un métier précis.
 *
 * C'est le point de contrôle que tu voulais : un compte ordinaire ne voit rien
 * du service tant que l'administration ne l'a pas désigné, et elle le désigne
 * pour un métier donné — pas comme « dépanneur » en général.
 *
 * Le téléphone est demandé ici parce que la fiche en exige un et que beaucoup de
 * profils n'en portent pas : bloquer l'ouverture pour cette seule raison
 * obligerait à faire modifier le profil avant de revenir.
 */
export function GrantProvider() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [trades, setTrades] = useState<Record<string, SosTrade>>({});
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

    startTransition(async () => {
      const result = await grantProviderAccess({
        profileId: member.id,
        trade: trades[member.id] ?? SOS_TRADES[0],
        displayName: name || "Dépanneur",
        phone: phones[member.id] ?? member.phone ?? "",
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
        <div key={member.id} className="flex flex-col gap-2 border-t border-[var(--color-hairline)] pt-2">
          <span className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
            {[member.first_name, member.last_name].filter(Boolean).join(" ") || "Sans nom"}
          </span>

          <div className="flex items-center gap-2">
            <select
              value={trades[member.id] ?? SOS_TRADES[0]}
              onChange={(e) =>
                setTrades((t) => ({ ...t, [member.id]: e.target.value as SosTrade }))
              }
              className={`${FIELD} w-[140px] flex-none`}
            >
              {SOS_TRADES.map((key) => (
                <option key={key} value={key}>
                  {TRADE_LABELS[key]}
                </option>
              ))}
            </select>

            <input
              value={phones[member.id] ?? member.phone ?? ""}
              onChange={(e) => setPhones((p) => ({ ...p, [member.id]: e.target.value }))}
              inputMode="tel"
              placeholder="Téléphone"
              className={`${FIELD} min-w-0 flex-1`}
            />

            <Button
              type="button"
              onClick={() => grant(member)}
              disabled={pending}
              className="flex-none"
            >
              {pending ? "…" : "Autoriser"}
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
