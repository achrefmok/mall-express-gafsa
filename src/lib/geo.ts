/**
 * Distance entre deux points, en mètres.
 *
 * Formule de haversine, qui traite la Terre comme une sphère. L'écart avec la
 * réalité — un ellipsoïde légèrement aplati — reste sous 0,5 %, soit deux mètres
 * sur quatre cents. Sans commune mesure avec la précision d'un GPS de téléphone,
 * et c'est bien à ce seul usage que sert cette fonction : décider si un chauffeur
 * a réellement bougé.
 */
export function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Faut-il publier cette position ?
 *
 * Le GPS d'un téléphone livre un relevé toutes les une à trois secondes, et il
 * en livre même à l'arrêt : la position tremble de quelques mètres sans que rien
 * ne bouge. Écrire chacun de ces relevés coûtait très cher, car chaque écriture
 * était ensuite diffusée à tous les clients qui regardaient la carte.
 *
 * Deux conditions suffisent, dont une seule doit être remplie :
 *   · un déplacement réel — au-delà du tremblement du capteur ;
 *   · un rafraîchissement de courtoisie, pour qu'un chauffeur immobile ne
 *     paraisse pas hors ligne.
 *
 * Un taxi en ville parcourt cinquante mètres en quelques secondes : la carte ne
 * perd rien de sa fraîcheur, seul le bruit disparaît.
 */
export const MIN_MOVE_METERS = 50;
export const MIN_INTERVAL_MS = 25_000;

export function shouldPublishPosition(
  last: { lat: number; lng: number; at: number } | null,
  next: { lat: number; lng: number },
  now = Date.now(),
): boolean {
  if (!last) return true;
  if (now - last.at >= MIN_INTERVAL_MS) return true;

  return distanceMeters(last, next) >= MIN_MOVE_METERS;
}
