/**
 * Les zones de Gafsa servies par le matching de taxi.
 *
 * Une seule source de vérité partagée par le client (« où allez-vous ? ») et
 * le chauffeur (« quel est mon trajet ? ») : les deux choisissent dans la même
 * liste, et les identifiants qu'ils envoient sont ceux que la base attend
 * dans ses `check`. Le nom affiché, lui, vient de la langue courante — la
 * liste ne porte que la clé, le libellé vit dans `fr`/`ar` ci-dessous.
 *
 * Ces identifiants sont contraints dans les migrations `20260901002000` :
 * les changer en base et ici aurait bien sûr les mêmes effets, mais vouloir
 * les faire diverger serait vouloir casser le matching.
 */

export const TAXI_ZONE_IDS = [
  "gafsa_centre",
  "ksar",
  "hay_nour",
  "hay_sourour",
  "hay_chabeb",
  "dwali",
  "lella",
] as const;

export type TaxiZoneId = (typeof TAXI_ZONE_IDS)[number];

export const TAXI_ZONES: ReadonlyArray<{
  id: TaxiZoneId;
  fr: string;
  ar: string;
  lat: number;
  lng: number;
}> = [
  { id: "gafsa_centre", fr: "Gafsa Centre", ar: "وسط قفصة", lat: 34.4245, lng: 8.7842 },
  { id: "ksar", fr: "Ksar", ar: "القصر", lat: 34.4215, lng: 8.8215 },
  { id: "hay_nour", fr: "Hay Nour", ar: "حي النور", lat: 34.434, lng: 8.784 },
  { id: "hay_sourour", fr: "Hay Sourour", ar: "حي سرور", lat: 34.419, lng: 8.777 },
  { id: "hay_chabeb", fr: "Hay Chabeb", ar: "حي الشباب", lat: 34.4205, lng: 8.795 },
  { id: "dwali", fr: "Dwali", ar: "الدوالي", lat: 34.43, lng: 8.805 },
  { id: "lella", fr: "Lella", ar: "للا", lat: 34.416, lng: 8.79 },
];

/** La zone la plus proche d'un point, pour présélectionner le départ. */
export function zoneLaPlusProche(point: { lat: number; lng: number } | null): TaxiZoneId | null {
  if (!point) return null;

  let meilleure: TaxiZoneId | null = null;
  let plusProche = Infinity;

  for (const zone of TAXI_ZONES) {
    const dlat = zone.lat - point.lat;
    const dlng = zone.lng - point.lng;
    const d = dlat * dlat + dlng * dlng;
    if (d < plusProche) {
      plusProche = d;
      meilleure = zone.id;
    }
  }

  return meilleure;
}

/** Gomme les zones du répertoire hors de l'application et de la base. */
export function estZone(id: string | null | undefined): id is TaxiZoneId {
  return id !== null && id !== undefined && (TAXI_ZONE_IDS as readonly string[]).includes(id);
}

/** Le libellé d'une zone dans une langue donnée, avec un repli en français. */
export function nomZone(id: string | null | undefined, locale: "fr" | "ar"): string | null {
  if (!estZone(id)) return null;
  const zone = TAXI_ZONES.find((z) => z.id === id);
  if (!zone) return null;
  return locale === "ar" ? zone.ar : zone.fr;
}