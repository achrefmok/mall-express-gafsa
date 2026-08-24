import { distanceMeters } from "./geo";

/**
 * Ce qui rapproche un chauffeur d'un trajet — et ce qu'on refuse d'inventer.
 *
 * L'écran taxi affiche « 92 % compatible · passe sur votre trajet ». Un tel
 * chiffre n'a de valeur que s'il est calculé. Sorti d'un générateur, il devient
 * une décoration : le client fait confiance au premier de la liste, tombe sur un
 * chauffeur qui part dans l'autre sens, et n'accorde plus jamais de crédit au
 * classement.
 *
 * Tout ce module ne travaille donc que sur des positions réelles. Quand une
 * donnée manque — pas de destination saisie, pas de position publiée par le
 * chauffeur, position trop vieille — il rend `null`, et l'écran affiche
 * l'absence plutôt qu'un pourcentage.
 */

/** Un point du monde. */
export interface Point {
  lat: number;
  lng: number;
}

/** Le trajet demandé. La destination reste facultative jusqu'à sa saisie. */
export interface Trajet {
  depart: Point;
  destination: Point | null;
}

/**
 * Vitesse moyenne retenue pour estimer une durée, en km/h.
 *
 * Gafsa n'a ni périphérique ni embouteillage durable : vingt-cinq kilomètres à
 * l'heure porte de bout en bout, feux et ralentissements compris. Une valeur
 * plus flatteuse donnerait des estimations que le chauffeur ne tiendrait pas, et
 * c'est lui qui essuierait le reproche.
 */
const VITESSE_KMH = 25;

/** Durée à pied ou en voiture, en minutes, jamais moins d'une. */
export function dureeMinutes(metres: number): number {
  return Math.max(1, Math.round((metres / 1000 / VITESSE_KMH) * 60));
}

/** « 600 m » en dessous du kilomètre, « 1,2 km » au-delà. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 50) * 50} m`;
  return `${(metres / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * La distance d'un point au trajet, et non aux deux extrémités.
 *
 * Un chauffeur peut être loin du départ *et* loin de l'arrivée tout en passant
 * juste devant vous à mi-chemin. Mesurer la distance au segment — et non aux
 * bornes — est ce qui distingue « il passe par là » de « il est à l'autre bout
 * de la ville ».
 *
 * La projection se fait en coordonnées planes. Sur une ville de dix kilomètres,
 * l'écart avec un calcul sphérique se compte en mètres : très en dessous de la
 * précision d'un GPS de téléphone, et sans commune mesure avec le coût d'une
 * vraie géodésique.
 */
export function distanceAuTrajet(point: Point, depart: Point, destination: Point): number {
  const ax = depart.lng;
  const ay = depart.lat;
  const bx = destination.lng;
  const by = destination.lat;
  const px = point.lng;
  const py = point.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const longueur = dx * dx + dy * dy;

  // Départ et arrivée confondus : le segment se réduit à un point.
  if (longueur === 0) return distanceMeters(point, depart);

  // Où tombe la projection sur le segment, bornée à ses extrémités.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / longueur));

  return distanceMeters(point, { lat: ay + t * dy, lng: ax + t * dx });
}

export type RaisonCompatibilite =
  | "vient-vous-chercher"
  | "passe-sur-votre-trajet"
  | "itineraire-different";

export interface Compatibilite {
  /** De 0 à 100. Calculé, jamais tiré au sort. */
  score: number;
  raison: RaisonCompatibilite;
  /** Distance du chauffeur au départ, en mètres. */
  auDepart: number;
  /** Écart minimal entre le chauffeur et le trajet, en mètres. */
  auTrajet: number;
  /**
   * Minutes qu'il lui faut pour venir jusqu'à vous.
   *
   * Ce n'est **pas** un détour, et le nom le dit. Mesurer un détour supposerait
   * de connaître la destination du chauffeur en course — la base ne la stocke
   * pas. Une première version l'appelait « détour » et calculait en réalité
   * cette même distance : le mot promettait ce que le chiffre ne contenait pas.
   */
  minutesJusquAVous: number;
}

/**
 * À quel point ce chauffeur convient à ce trajet.
 *
 * Deux questions, dans cet ordre : est-il près de vous, et va-t-il dans votre
 * direction. La première décide seule quand le chauffeur est libre — il n'a pas
 * d'itinéraire, il vient vous chercher. La seconde compte quand il est déjà en
 * course : ce qui vous intéresse alors est qu'il passe devant votre porte, pas
 * qu'il fasse demi-tour.
 *
 * Rend `null` dès qu'une donnée manque. C'est délibéré : un pourcentage calculé
 * sur une position inconnue vaudrait moins que pas de pourcentage du tout.
 */
export function compatibilite(
  chauffeur: Point | null,
  trajet: Trajet | null,
  libre: boolean,
): Compatibilite | null {
  if (!chauffeur || !trajet) return null;

  const auDepart = distanceMeters(chauffeur, trajet.depart);

  /*
    Chauffeur libre : seule la distance compte.

    Il n'a pas d'itinéraire à respecter, donc pas de détour à mesurer. Cinq cents
    mètres valent une note pleine ; au-delà de six kilomètres, la note tombe à
    zéro — à cette distance dans Gafsa, un autre chauffeur sera toujours mieux
    placé.
  */
  if (libre) {
    const score = Math.round(100 * Math.max(0, Math.min(1, (6000 - auDepart) / 5500)));
    return {
      score: auDepart <= 500 ? 100 : score,
      raison: "vient-vous-chercher",
      auDepart,
      auTrajet: 0,
      minutesJusquAVous: dureeMinutes(auDepart),
    };
  }

  /*
    Chauffeur en course : c'est l'écart au trajet qui décide.

    Sans destination saisie, on ne connaît pas de trajet : impossible de dire
    s'il passe par là. On ne rend rien plutôt que d'affirmer quelque chose.
  */
  if (!trajet.destination) return null;

  const auTrajet = distanceAuTrajet(chauffeur, trajet.depart, trajet.destination);

  // Huit cents mètres de l'axe : on est encore « sur le trajet ». Au-delà de
  // trois kilomètres, ce n'est plus le même chemin.
  const proximite = Math.max(0, Math.min(1, (3000 - auTrajet) / 2200));
  const score = Math.round(100 * proximite);

  return {
    score,
    raison: auTrajet <= 800 ? "passe-sur-votre-trajet" : "itineraire-different",
    auDepart,
    auTrajet,
    minutesJusquAVous: dureeMinutes(auDepart),
  };
}

/**
 * Les lieux de Gafsa qu'on sait placer sur la carte.
 *
 * Il n'y a pas de service de géocodage ici, et en ajouter un ferait dépendre
 * l'écran d'un tiers pour la fonction la plus élémentaire : dire où l'on va. Une
 * courte liste des destinations réellement demandées couvre l'essentiel des
 * courses, fonctionne hors réseau, et ne coûte rien.
 *
 * Le reste se désigne en touchant la carte — ce qui est souvent plus rapide que
 * d'écrire, et toujours plus précis qu'un nom de quartier.
 */
export interface Lieu extends Point {
  id: string;
  nom: string;
  nomAr: string;
}

export const LIEUX_GAFSA: readonly Lieu[] = [
  { id: "aeroport", nom: "Aéroport Gafsa Ksar", nomAr: "مطار قفصة القصر", lat: 34.422, lng: 8.8225 },
  { id: "gare", nom: "Gare de Gafsa", nomAr: "محطة قفصة", lat: 34.4183, lng: 8.7845 },
  { id: "hopital", nom: "Hôpital Houcine Bouzaiene", nomAr: "مستشفى الحسين بوزيان", lat: 34.4265, lng: 8.7797 },
  { id: "marche", nom: "Marché central", nomAr: "السوق المركزية", lat: 34.4249, lng: 8.7841 },
  { id: "universite", nom: "Université de Gafsa", nomAr: "جامعة قفصة", lat: 34.4139, lng: 8.7688 },
  { id: "piscine", nom: "Piscine romaine", nomAr: "الحمامات الرومانية", lat: 34.4256, lng: 8.7806 },
  { id: "gare-louage", nom: "Station de louages", nomAr: "محطة اللواجات", lat: 34.4211, lng: 8.7869 },
  { id: "mall", nom: "Mall Express Gafsa", nomAr: "مول إكسبرس قفصة", lat: 34.4257, lng: 8.7842 },
];
