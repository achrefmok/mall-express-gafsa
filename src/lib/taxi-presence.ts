/**
 * Ce qu'on sait d'un chauffeur, et à quel point on le sait.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le défaut que ce module corrige
 * ────────────────────────────────────────────────────────────────────────
 *
 * L'application déduisait la disponibilité d'un chauffeur de la fraîcheur de sa
 * position : plus de relevé depuis dix minutes, donc hors ligne, donc retiré de
 * la carte. Le raisonnement paraît solide et il est faux. Un chauffeur ferme
 * l'application dès qu'il démarre — il conduit, il répond au téléphone, l'écran
 * s'éteint. Dix minutes plus tard, un homme parfaitement libre était invisible.
 *
 * Deux questions étaient confondues en une :
 *
 *   1. **Est-il disponible ?** C'est une décision qu'il prend, que le serveur
 *      conserve, et qu'aucun événement technique ne doit défaire. Fermer une
 *      application n'est pas se déclarer occupé.
 *
 *   2. **Où est-il ?** C'est une mesure, elle vieillit, et il faut le dire.
 *
 * Ce module les sépare. `statut` répond à la première et ne regarde jamais
 * l'horloge. `precision` répond à la seconde et ne regarde que ça.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que le web ne permet pas, et qu'il ne faut pas prétendre
 * ────────────────────────────────────────────────────────────────────────
 *
 * Aucune application web ne peut relever une position GPS pendant qu'elle est
 * fermée. `navigator.geolocation` n'existe pas dans un service worker, il n'y a
 * pas d'API de géolocalisation en arrière-plan dans les standards, et la
 * synchronisation périodique — Chrome/Android seulement, douze heures d'écart
 * minimum — ne donne aucun accès au capteur. Un vrai suivi continu demande une
 * application native.
 *
 * D'où la ligne de conduite adoptée ici : puisqu'on ne peut pas savoir où il est
 * en permanence, on ne fait pas semblant. On garde ce qu'il a déclaré, on date
 * honnêtement la dernière position connue, et on laisse le client décider.
 */

import type { TaxiStatus } from "@/types/database";

/* Le vocabulaire vient du schéma : une seule liste, et la base la contraint
   déjà par un `check`. La redéfinir ici garantirait qu'un jour les deux
   divergent sans que rien ne le signale. */
export type { TaxiStatus };

/**
 * Depuis quand la position n'est-elle plus une position ?
 *
 * Trois paliers plutôt qu'un seuil unique, parce qu'un point vieux de trois
 * minutes et un point vieux de trois heures n'ont pas la même valeur, et que les
 * traiter pareil oblige à choisir entre mentir et effacer.
 *
 *   · deux minutes — il roule, le point le suit ;
 *   · un quart d'heure — il a rangé son téléphone, le point vaut encore ;
 *   · deux heures — c'est un indice de quartier, plus une position. On le montre
 *     estompé, daté, jamais comme une certitude.
 *
 * Au-delà, on ne place plus rien sur la carte. Le chauffeur reste listé et
 * appelable : c'est précisément la différence entre « je ne sais pas où il est »
 * et « il n'est pas là ».
 */
export const POSITION_DIRECTE_MS = 2 * 60_000;
export const POSITION_RECENTE_MS = 15 * 60_000;
export const POSITION_UTILE_MS = 2 * 60 * 60_000;

/** À quel point la dernière position connue est encore une information. */
export type Precision = "directe" | "recente" | "approximative" | "inconnue";

export interface DriverRow {
  status?: string | null;
  status_since?: string | null;
  /** Colonne d'origine, conservée : elle sert de repli avant la migration. */
  is_available?: boolean | null;
  seats_total?: number | null;
  seats_free?: number | null;
  lat?: number | null;
  lng?: number | null;
  position_updated_at?: string | null;
  last_seen_at?: string | null;
}

export interface Presence {
  /** Ce que le chauffeur a déclaré. Indépendant de toute horloge. */
  statut: TaxiStatus;
  /** Places restantes, ou `null` quand il ne l'a jamais renseigné. */
  places: number | null;
  /** Peut-on lui envoyer une demande de course ? */
  joignable: boolean;
  /** Une position connue, quel que soit son âge. */
  positionConnue: boolean;
  /** Faut-il la dessiner sur la carte ? */
  cartographiable: boolean;
  precision: Precision;
  /** Âge de la position en millisecondes, `null` si aucune. */
  age: number | null;
}

/** Un statut lisible depuis une colonne texte, sans faire confiance à la base. */
function lireStatut(row: DriverRow): TaxiStatus {
  const brut = row.status;

  if (brut === "libre" || brut === "places" || brut === "occupe" || brut === "hors_ligne") {
    return brut;
  }

  /*
    Repli avant migration.

    Les changements de schéma sont appliqués à la main dans l'éditeur SQL de
    Supabase, donc le code tourne forcément un moment sur des lignes qui n'ont
    pas encore la colonne. Sans ce repli, tous les chauffeurs passeraient
    « hors ligne » entre le déploiement et le collage du DDL — exactement la
    panne que ce module existe pour empêcher.
  */
  return row.is_available ? "libre" : "occupe";
}

function ageDe(horodatage: string | null | undefined, maintenant: number): number | null {
  if (!horodatage) return null;

  const at = Date.parse(horodatage);
  if (Number.isNaN(at)) return null;

  // Une horloge de téléphone en avance donnerait un âge négatif ; on le ramène
  // à zéro plutôt que de laisser un « il y a -3 minutes » s'afficher.
  return Math.max(0, maintenant - at);
}

export function precisionDe(age: number | null): Precision {
  if (age === null) return "inconnue";
  if (age <= POSITION_DIRECTE_MS) return "directe";
  if (age <= POSITION_RECENTE_MS) return "recente";
  if (age <= POSITION_UTILE_MS) return "approximative";
  return "inconnue";
}

/**
 * L'état complet d'un chauffeur, tel qu'on peut l'affirmer.
 *
 * `maintenant` est un paramètre pour que les tests n'aient pas à attendre.
 */
export function presenceDe(row: DriverRow, maintenant = Date.now()): Presence {
  const statut = lireStatut(row);
  const age = ageDe(row.position_updated_at, maintenant);
  const precision = precisionDe(age);

  const positionConnue =
    row.lat !== null && row.lat !== undefined && row.lng !== null && row.lng !== undefined;

  /*
    Les places ne se déduisent pas du statut, et le statut ne se déduit pas des
    places. Un chauffeur peut se déclarer occupé alors qu'il lui reste trois
    sièges — il finit sa course et ne veut plus personne. C'est son droit, et
    l'inférer à sa place produirait des demandes qu'il refuserait.
  */
  const places =
    typeof row.seats_free === "number" && Number.isFinite(row.seats_free)
      ? Math.max(0, Math.trunc(row.seats_free))
      : null;

  return {
    statut,
    places,
    // Occupé et hors ligne ne reçoivent rien : faire sonner quelqu'un qui vient
    // de dire non est le meilleur moyen de lui faire couper les notifications.
    joignable: statut === "libre" || statut === "places",
    positionConnue,
    cartographiable: positionConnue && precision !== "inconnue",
    precision,
    age,
  };
}

/**
 * Le statut après une réservation de `sieges` places.
 *
 * Le passage à « occupé » n'est pas décoratif : c'est ce qui empêche un
 * cinquième client de demander une place dans une voiture qui en a quatre. Il
 * se produit quand il ne reste plus rien, et seulement là.
 *
 * Retourne les places restantes et le statut à écrire. Un chauffeur qui n'a
 * jamais renseigné ses places reste tel quel — on ne va pas décider pour lui
 * qu'il est complet à partir d'un chiffre qu'il n'a pas donné.
 */
export function apresReservation(
  actuel: { statut: TaxiStatus; places: number | null },
  sieges: number,
): { statut: TaxiStatus; places: number | null } {
  if (actuel.places === null) return actuel;

  const restantes = Math.max(0, actuel.places - Math.max(1, Math.trunc(sieges)));

  return {
    places: restantes,
    statut: restantes === 0 ? "occupe" : "places",
  };
}

/**
 * Classer les chauffeurs pour un client donné.
 *
 * L'ordre traduit une hiérarchie d'utilité, pas une note. D'abord ceux qui
 * peuvent réellement prendre quelqu'un, ensuite ceux dont on sait où ils sont,
 * ensuite les plus proches. Un chauffeur libre mais mal situé passe devant un
 * chauffeur occupé parfaitement localisé : la position ne sert à rien si la
 * voiture est pleine.
 */
export function rangPresence(p: Presence): number {
  if (!p.joignable) return 3;
  if (!p.cartographiable) return 2;
  return p.precision === "directe" ? 0 : 1;
}
