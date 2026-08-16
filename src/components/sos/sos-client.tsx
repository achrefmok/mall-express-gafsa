"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/lib/format";
import { SOS_TRADES, type SosTrade } from "@/lib/sos";
import { Card, EmptyState, Tag } from "@/components/ui/primitives";
import type { DriverPin } from "@/components/taxi/driver-map";

/*
  La carte des chauffeurs, réemployée telle quelle.

  Elle ne sait rien du taxi : elle place des points nommés, colorés selon une
  disponibilité. En écrire une seconde pour le SOS aurait dupliqué le chargement
  différé de Leaflet, l'autorisation des tuiles et le rattrapage de mesure —
  trois pièges déjà payés une fois.
*/
const ProviderMap = dynamic(
  () => import("@/components/taxi/driver-map").then((m) => m.DriverMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full rounded-[18px] bg-[var(--color-track)]" />,
  },
);

export interface Provider {
  id: string;
  trade: SosTrade;
  display_name: string;
  phone: string;
  description: string | null;
  travels: boolean;
  is_available: boolean;
  lat: number | null;
  lng: number | null;
}

const SELECT =
  "id, trade, display_name, phone, description, travels, is_available, lat, lng";

/**
 * SOS — trouver un dépanneur, tout de suite.
 *
 * Le filtre par métier est en tête, et il est le cœur de l'écran : quelqu'un
 * dont la voiture ne démarre pas ne veut pas faire défiler des plombiers. Le
 * compte par métier s'affiche sur chaque puce, pour qu'on voie où il y a du
 * monde avant de cliquer.
 *
 * Comme pour le taxi, aucune mise en relation automatique : on voit qui est
 * disponible, où il est, et on appelle. C'est ce qui se fait déjà de bouche à
 * oreille à Gafsa, en remplaçant « je ne connais personne » par une liste.
 */
export function SosClient({ initialProviders }: { initialProviders: Provider[] }) {
  const { t } = useI18n();
  const [providers, setProviders] = useState(initialProviders);
  const [trade, setTrade] = useState<SosTrade | "all">("all");

  /*
    La disponibilité change en permanence, et c'est toute la valeur de l'écran.
    Un annuaire qui affiche « disponible » pour quelqu'un déjà en intervention
    est pire que pas d'annuaire : le client appelle, se fait éconduire, et ne
    revient pas.
  */
  useEffect(() => {
    const supabase = createClient();

    const reload = async () => {
      const { data } = await supabase
        .from("sos_providers")
        .select(SELECT)
        .eq("is_approved", true)
        .order("is_available", { ascending: false });

      if (data) setProviders(data as Provider[]);
    };

    const channel = supabase
      .channel("sos-providers")
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_providers" }, () =>
        void reload(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  if (providers.length === 0) {
    return <EmptyState title={t.sos.none} body={t.sos.noneBody} />;
  }

  const shown = trade === "all" ? providers : providers.filter((p) => p.trade === trade);
  const free = shown.filter((p) => p.is_available);

  const pins: DriverPin[] = shown
    .filter((p) => p.lat !== null && p.lng !== null)
    .map((p) => ({
      id: p.id,
      name: p.display_name,
      lat: p.lat!,
      lng: p.lng!,
      available: p.is_available,
    }));

  /* Seuls les métiers réellement représentés sont proposés : un filtre qui ne
     renvoie jamais rien n'apprend qu'une chose, c'est que le service est vide. */
  const present = SOS_TRADES.filter((key) => providers.some((p) => p.trade === key));

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* ─── Filtre par métier ─────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label={t.sos.trade}
        className="no-sb flex flex-none gap-[6px] overflow-x-auto pb-1"
      >
        {([["all", t.sos.all] as const] as Array<readonly [SosTrade | "all", string]>)
          .concat(present.map((key) => [key, t.sos.trades[key]] as const))
          .map(([key, label]) => {
            const active = trade === key;
            const count = key === "all" ? providers.length : providers.filter((p) => p.trade === key).length;

            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTrade(key)}
                className={cx(
                  "flex-none rounded-[12px] px-[11px] py-[6px] text-[10.5px] font-bold whitespace-nowrap",
                  active
                    ? "bg-[var(--color-brand)] text-white"
                    : "border border-[var(--color-outline)] text-[var(--color-muted)]",
                )}
              >
                {label} · {count}
              </button>
            );
          })}
      </div>

      {pins.length > 0 && (
        <div className="h-[32vh] min-h-[190px] flex-none overflow-hidden rounded-[18px]">
          <ProviderMap drivers={pins} />
        </div>
      )}

      <p className="flex-none text-[11px] font-bold text-[var(--color-ink)]">
        {free.length > 0
          ? t.sos.availableNow.replace("{n}", String(free.length))
          : t.sos.noneFree}
      </p>

      <div className="no-sb flex flex-1 flex-col gap-2 overflow-y-auto pb-4">
        {shown.length === 0 && (
          <p className="py-6 text-center text-[11px] text-[var(--color-muted)]">
            {t.sos.noneForTrade}
          </p>
        )}

        {shown.map((provider) => (
          <Card key={provider.id} className="flex items-center gap-[10px] p-3">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{
                background: provider.is_available ? "var(--color-ok, #2f7d5d)" : "var(--color-faint)",
              }}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
                {provider.display_name}
              </p>
              <p className="truncate text-[10px] text-[var(--color-muted)]">
                {[
                  t.sos.trades[provider.trade],
                  provider.travels ? t.sos.travels : t.sos.inShop,
                  provider.description,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <Tag tone={provider.is_available ? "tinted" : "outline"}>
              {provider.is_available ? t.sos.free : t.sos.busy}
            </Tag>

            {/* Un appel direct : sur une panne, personne n'ouvre une messagerie. */}
            <a
              href={`tel:${provider.phone}`}
              className="flex-none rounded-[14px] bg-[var(--color-brand)] px-3 py-[7px] text-[10px] font-semibold text-white"
            >
              {t.sos.call}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
