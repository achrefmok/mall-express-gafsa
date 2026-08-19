"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Card, EmptyState } from "@/components/ui/primitives";
import type { DriverPin, MapLabels } from "@/components/taxi/driver-map";

/*
  La même carte que le taxi et le SOS.

  Elle ne sait rien de son sujet : elle place des points nommés et ouvre une
  bulle. En écrire une troisième aurait dupliqué le chargement différé de
  Leaflet, l'autorisation des tuiles dans la CSP et le rattrapage de mesure —
  trois pièges déjà payés.
*/
const Map = dynamic(() => import("@/components/taxi/driver-map").then((m) => m.DriverMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-[18px] bg-[var(--color-track)]" />,
});

export interface ShopPin {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  mall_level: number | null;
  mall_unit: string | null;
}

/**
 * Où sont les boutiques, et comment s'y rendre.
 *
 * Seules les boutiques approuvées figurent ici — c'est la garantie que porte la
 * carte : un client qui s'y déplace doit trouver un commerce que la plateforme a
 * vérifié. Une boutique en attente n'y apparaît pas, même si elle a renseigné sa
 * position.
 *
 * L'itinéraire s'ouvre dans l'application de cartographie du téléphone plutôt
 * que dans la page : c'est elle qui connaît le trafic, la marche, et qui parle
 * pendant le trajet. Réimplémenter un guidage n'aurait aucun sens.
 *
 * Les boutiques sans position restent listées dessous, avec leur local au mall.
 * Les écarter reviendrait à les cacher parce qu'elles n'ont pas rempli un champ
 * facultatif — alors qu'à l'intérieur du mall, « Niveau 1, local B12 » guide
 * mieux qu'un point sur une carte.
 */
export function ShopsMap({ shops }: { shops: ShopPin[] }) {
  const { t } = useI18n();

  const located = shops.filter((s) => s.latitude !== null && s.longitude !== null);
  const others = shops.filter((s) => s.latitude === null || s.longitude === null);

  const pins: DriverPin[] = located.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.latitude!,
    lng: s.longitude!,
    available: true,
    detail: s.mall_unit ? `Niveau ${s.mall_level ?? "?"} · ${s.mall_unit}` : null,
    phone: s.phone,
    link: {
      // `dir` est l'adresse d'itinéraire de Google Maps ; sur téléphone, elle
      // ouvre l'application installée plutôt que le site.
      href: `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`,
      label: t.shops.directions,
    },
  }));

  const labels: MapLabels = {
    free: t.shops.verified,
    busy: t.shops.verified,
    call: t.taxi.call,
    whatsApp: t.common.whatsApp,
  };

  if (shops.length === 0) {
    return <EmptyState title={t.shops.none} body={t.shops.noneBody} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {pins.length > 0 ? (
        <div className="h-[42vh] min-h-[240px] flex-none overflow-hidden rounded-[18px]">
          <Map drivers={pins} labels={labels} />
        </div>
      ) : (
        <Card className="flex-none p-3">
          <p className="text-[11px] leading-[1.5] text-[var(--color-muted)]">{t.shops.noPosition}</p>
        </Card>
      )}

      <div className="no-sb flex flex-1 flex-col gap-2 overflow-y-auto pb-4">
        {[...located, ...others].map((shop) => (
          <Link key={shop.id} href={`/boutique/${shop.slug}`}>
            <Card className="flex items-center gap-[10px] p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
                  {shop.name}
                </p>
                <p className="truncate text-[10px] text-[var(--color-muted)]">
                  {shop.mall_unit
                    ? `Niveau ${shop.mall_level ?? "?"} · ${shop.mall_unit}`
                    : shop.latitude !== null
                      ? t.shops.onMap
                      : t.shops.noPositionShort}
                </p>
              </div>

              <span className="flex-none rounded-[10px] bg-[var(--color-brand-tint)] px-2 py-[3px] text-[9.5px] font-bold text-[var(--color-brand)]">
                {t.shops.verified}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
