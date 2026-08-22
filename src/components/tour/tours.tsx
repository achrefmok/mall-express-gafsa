"use client";

import { useI18n } from "@/lib/i18n/provider";
import { ProductTour, ReplayTourButton } from "./product-tour";

/*
  Deux guides, deux clés de mémorisation.

  Un vendeur est aussi un client : lui montrer le guide vendeur ne doit pas
  dépendre du fait qu'il a déjà vu celui du site, et l'inverse non plus.

  Les étapes viennent du dictionnaire, donc traduites : le guide s'adresse
  d'abord à des personnes qui n'ont jamais utilisé de place de marché, et le lire
  dans sa langue n'est pas un supplément.
*/

export function ClientTour() {
  const { t } = useI18n();
  return <ProductTour steps={t.tour.client} storageKey="meg-tour-client" startOn="/accueil" />;
}

export function VendorTour() {
  const { t } = useI18n();
  return <ProductTour steps={t.tour.vendor} storageKey="meg-tour-vendor" startOn="/vendeur" />;
}

export function ReplayClientTour() {
  const { t } = useI18n();
  return <ReplayTourButton label={t.tour.replayClient} />;
}

export function ReplayVendorTour() {
  const { t } = useI18n();
  return <ReplayTourButton label={t.tour.replayVendor} />;
}
