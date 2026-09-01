"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n/provider";
import type { DriverPin, MapLabels } from "@/components/taxi/driver-map";

/*
  La même carte que le taxi, le SOS et les boutiques : Leaflet, chargé seul au
  moment où l'on en a besoin. Elle place les pharmacies de garde du jour et
  ouvre une bulle qui donne l'adresse, le téléphone et l'itinéraire.
*/
const Map = dynamic(() => import("@/components/taxi/driver-map").then((m) => m.DriverMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-[18px] bg-[var(--color-track)]" />,
});

export interface PharmacyPin {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Où sont les pharmacies de garde du jour, et comment s'y rendre. */
export function PharmaciesMap({ pharmacies }: { pharmacies: PharmacyPin[] }) {
  const { t } = useI18n();

  const located = pharmacies.filter((p) => p.latitude !== null && p.longitude !== null);

  const pins: DriverPin[] = located.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.latitude!,
    lng: p.longitude!,
    available: true,
    detail: p.address,
    phone: p.phone,
    link: {
      href: `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`,
      label: t.services.directions,
    },
    initials: p.name.slice(0, 2).toUpperCase(),
  }));

  const labels: MapLabels = {
    free: t.services.pharmacyOnDuty,
    busy: t.services.pharmacyOnDuty,
    call: t.taxi.call,
    whatsApp: t.common.whatsApp,
  };

  if (located.length === 0) return null;

  return (
    <div className="h-[34vh] min-h-[220px] flex-none overflow-hidden rounded-[16px]">
      <Map drivers={pins} labels={labels} />
    </div>
  );
}
