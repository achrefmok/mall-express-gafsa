"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { usePoll } from "@/lib/use-poll";
import { isPositionFresh } from "@/lib/geo";
import { Card, EmptyState, Tag } from "@/components/ui/primitives";
import type { DriverPin, MapLabels } from "./driver-map";

/*
  La carte ne se rend que dans le navigateur : Leaflet touche `window` dès son
  import, et un rendu serveur le ferait échouer.
*/
const DriverMap = dynamic(() => import("./driver-map").then((m) => m.DriverMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-[18px] bg-[var(--color-track)]" />,
});

export interface Driver {
  id: string;
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_available: boolean;
  lat: number | null;
  lng: number | null;
  position_updated_at: string | null;
}

/**
 * Trouver un taxi libre, maintenant.
 *
 * Volontairement sans mise en relation automatique ni suivi de course : le
 * client voit qui est libre, où il se trouve, et l'appelle. C'est ce qui se fait
 * déjà par téléphone à Gafsa, en remplaçant « je ne sais pas qui appeler » par
 * une carte.
 *
 * Les chauffeurs sans position connue restent dans la liste mais pas sur la
 * carte : ne pas les afficher du tout reviendrait à les rendre injoignables
 * parce que leur téléphone n'a pas encore transmis ses coordonnées.
 */
export function TaxiClient({ initialDrivers }: { initialDrivers: Driver[] }) {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState(initialDrivers);

  /*
    La disponibilité change en permanence — c'est toute la valeur de l'écran. Un
    annuaire qui affiche « libre » pour un chauffeur en course est pire que pas
    d'annuaire du tout : le client appelle, se fait envoyer promener, et ne
    revient pas.

    Relecture périodique, et non abonnement aux changements. L'abonnement
    diffusait chaque position publiée à tous les spectateurs, et chacun relisait
    ensuite la liste entière : le coût croissait comme le produit des chauffeurs
    par les spectateurs, et le quota mensuel de messages temps réel s'épuisait en
    moins d'une journée avec cinq chauffeurs et trente spectateurs.

    Trente secondes ne se remarquent pas : un chauffeur qui prend une course
    reste joignable, et la carte le montre libre une demi-minute de trop au pire.
    Le crochet suspend tout quand l'onglet passe à l'arrière-plan.
  */
  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("taxi_drivers")
      .select("id, display_name, phone, vehicle, plate, is_available, lat, lng, position_updated_at")
      .eq("is_approved", true)
      .order("is_available", { ascending: false });

    if (data) setDrivers(data);
  }, []);

  usePoll(reload, 30_000);

  /*
    Seuls les points encore frais vont sur la carte.

    Une position de la veille placerait un repère net à un endroit où plus
    personne n'est : le client s'y rendrait avec la confiance que donne une carte.
    Le chauffeur reste dans la liste, appelable, avec la mention que sa position
    n'est plus connue — c'est l'information honnête.
  */
  const pins: DriverPin[] = drivers
    .filter((d) => d.lat !== null && d.lng !== null && isPositionFresh(d.position_updated_at))
    .map((d) => ({
      id: d.id,
      name: d.display_name,
      lat: d.lat!,
      lng: d.lng!,
      available: d.is_available,
      detail: [d.vehicle, d.plate].filter(Boolean).join(" · ") || null,
      phone: d.phone,
    }));

  const labels: MapLabels = {
    free: t.taxi.free,
    busy: t.taxi.busy,
    call: t.taxi.call,
    whatsApp: t.common.whatsApp,
  };

  const free = drivers.filter((d) => d.is_available);

  if (drivers.length === 0) {
    return <EmptyState title={t.taxi.none} body={t.taxi.noneBody} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="h-[38vh] min-h-[220px] flex-none overflow-hidden rounded-[18px]">
        <DriverMap drivers={pins} labels={labels} />
      </div>

      <p className="flex-none text-[11px] font-bold text-[var(--color-ink)]">
        {free.length > 0 ? t.taxi.availableNow.replace("{n}", String(free.length)) : t.taxi.noneFree}
      </p>

      <div className="no-sb flex flex-1 flex-col gap-2 overflow-y-auto pb-4">
        {drivers.map((driver) => (
          <Card key={driver.id} className="flex items-center gap-[10px] p-3">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: driver.is_available ? "var(--color-ok, #2f7d5d)" : "var(--color-faint)" }}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
                {driver.display_name}
              </p>
              <p className="truncate text-[10px] text-[var(--color-muted)]">
                {[
                  [driver.vehicle, driver.plate].filter(Boolean).join(" · ") || t.taxi.taxi,
                  isPositionFresh(driver.position_updated_at) ? null : t.taxi.positionStale,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <Tag tone={driver.is_available ? "tinted" : "outline"}>
              {driver.is_available ? t.taxi.free : t.taxi.busy}
            </Tag>

            {/*
              Un appel direct plutôt qu'une messagerie : un client qui cherche un
              taxi veut partir maintenant, pas entamer une conversation.
            */}
            <a
              href={`tel:${driver.phone}`}
              className="flex-none rounded-[14px] bg-[var(--color-brand)] px-3 py-[7px] text-[10px] font-semibold text-white"
            >
              {t.taxi.call}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
