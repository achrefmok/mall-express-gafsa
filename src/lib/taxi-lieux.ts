import { TAXI_ZONES, type TaxiZoneId } from "./taxi-zones";

/**
 * Le répertoire des lieux de Gafsa, pour la saisie d'une destination.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi ce fichier existe
 * ────────────────────────────────────────────────────────────────────────
 *
 * La liste vivait en dur dans `taxi-client.tsx`, recopiée depuis
 * `taxi-zones.ts` — et la copie avait dérivé. Les sept zones y portaient des
 * longitudes comprises entre 8,67 et 8,70, là où le répertoire de référence
 * (et la carte, centrée sur `[34.425, 8.784]`) les place entre 8,78 et 8,82.
 *
 * **Neuf kilomètres d'écart, plein ouest, en plein désert.** Choisir « Lella »
 * dans la liste posait le marqueur hors de la ville, faussait la distance
 * annoncée au chauffeur, et l'itinéraire tracé partait dans le vide.
 *
 * Une seule liste, donc, et les zones ne sont plus recopiées : elles sont
 * *dérivées* de `TAXI_ZONES`, dont les identifiants sont contraints par un
 * `check` en base. Les deux ne peuvent plus diverger sans que la compilation
 * ne le dise.
 */

export interface Lieu {
  /** Le nom affiché et recherché. */
  nom: string;
  lat: number;
  lng: number;
  /** Renseigné pour les sept zones du matching ; nul pour les points d'intérêt. */
  zone: TaxiZoneId | null;
  /** Catégorie, pour l'icône de la suggestion. */
  genre: "zone" | "transport" | "sante" | "commerce" | "public";
}

/**
 * Les points d'intérêt, en plus des zones.
 *
 * Coordonnées relevées dans l'agglomération réelle — latitude autour de 34,42
 * et longitude autour de 8,78. Un point qui sort de cette fenêtre est presque
 * sûrement une erreur de saisie, et c'est exactement ce qui s'était produit.
 */
const POINTS: ReadonlyArray<Lieu> = [
  { nom: "Gare de louages", lat: 34.4262, lng: 8.7869, zone: null, genre: "transport" },
  { nom: "Gare SNCFT", lat: 34.4288, lng: 8.7801, zone: null, genre: "transport" },
  { nom: "Aéroport de Gafsa — Ksar", lat: 34.422, lng: 8.8225, zone: "ksar", genre: "transport" },
  { nom: "Hôpital régional Houcine Bouzaiene", lat: 34.4271, lng: 8.7796, zone: null, genre: "sante" },
  { nom: "Marché central", lat: 34.4251, lng: 8.7855, zone: "gafsa_centre", genre: "commerce" },
  { nom: "G-Mall", lat: 34.4258, lng: 8.7828, zone: "gafsa_centre", genre: "commerce" },
  { nom: "Piscines romaines", lat: 34.4232, lng: 8.7808, zone: null, genre: "public" },
  { nom: "Université de Gafsa", lat: 34.4318, lng: 8.7766, zone: null, genre: "public" },
  { nom: "Stade municipal", lat: 34.4295, lng: 8.7893, zone: null, genre: "public" },
  { nom: "Municipalité de Gafsa", lat: 34.4249, lng: 8.7837, zone: "gafsa_centre", genre: "public" },
];

/** Les zones du matching, puis les points d'intérêt. */
export const LIEUX: ReadonlyArray<Lieu> = [
  ...TAXI_ZONES.map<Lieu>((z) => ({
    nom: z.fr,
    lat: z.lat,
    lng: z.lng,
    zone: z.id,
    genre: "zone",
  })),
  ...POINTS,
];

/** Le nom arabe d'une zone, quand la langue courante l'est. */
export function nomLieu(lieu: Lieu, locale: "fr" | "ar"): string {
  if (locale !== "ar" || lieu.zone === null) return lieu.nom;
  return TAXI_ZONES.find((z) => z.id === lieu.zone)?.ar ?? lieu.nom;
}

/** Sans accents ni casse : « Hôpital » se trouve en tapant « hopital ». */
const DIACRITIQUES = /[̀-ͯ]/g;

function aplati(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .toLowerCase()
    .trim();
}

/**
 * Les lieux qui correspondent à une saisie.
 *
 * Ceux qui *commencent* par la saisie d'abord — quelqu'un qui tape « ga »
 * cherche « Gafsa Centre », pas « Gare de louages » —, puis ceux qui la
 * contiennent. La recherche porte toujours sur les deux langues — un nom arabe
 * se trouve en le tapant, quelle que soit la langue de l interface, et rien ne
 * justifierait de le cacher a quelqu un qui l ecrit.
 */
export function chercherLieux(saisie: string, limite = 6): Lieu[] {
  const q = aplati(saisie);
  if (q.length < 1) return [];

  const debut: Lieu[] = [];
  const dedans: Lieu[] = [];

  for (const lieu of LIEUX) {
    const noms = [aplati(lieu.nom)];
    if (lieu.zone) {
      const zone = TAXI_ZONES.find((z) => z.id === lieu.zone);
      if (zone) noms.push(aplati(zone.ar));
    }

    if (noms.some((n) => n.startsWith(q))) debut.push(lieu);
    else if (noms.some((n) => n.includes(q))) dedans.push(lieu);
  }

  return [...debut, ...dedans].slice(0, limite);
}

/** Le lieu exactement nommé, s'il existe. Sert à retrouver des coordonnées. */
export function lieuExact(nom: string): Lieu | null {
  const q = aplati(nom);
  return LIEUX.find((l) => aplati(l.nom) === q) ?? null;
}

/**
 * Les suggestions à montrer quand le champ est encore vide.
 *
 * Les zones d'abord : ce sont elles qui alimentent le matching par trajet, et
 * une destination choisie parmi elles trouve des chauffeurs bien plus souvent
 * qu'une destination libre, qui n'atteint que ceux ayant accepté de les
 * recevoir.
 */
export function suggestionsInitiales(limite = 6): Lieu[] {
  return LIEUX.filter((l) => l.genre === "zone").slice(0, limite);
}
