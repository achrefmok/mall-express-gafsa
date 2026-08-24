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

/**
 * Cette position vaut-elle encore quelque chose ?
 *
 * Un chauffeur qui partage sa position écrit au moins toutes les vingt-cinq
 * secondes. Passé dix minutes sans nouvelle, il a fermé l'écran, éteint son
 * téléphone ou perdu le réseau — et son dernier point ne dit plus où il est.
 *
 * Une position périmée est pire que pas de position : elle envoie le client à un
 * endroit précis, avec l'assurance que donne un point sur une carte. Un chauffeur
 * sans position connue reste appelable ; un chauffeur mal situé fait perdre un
 * déplacement.
 *
 * Le seuil est large à dessein. Un tunnel, un ascenseur, une minute sans réseau
 * ne doivent pas faire disparaître quelqu'un de la carte.
 */
export const POSITION_FRESH_MS = 10 * 60_000;

export function isPositionFresh(updatedAt: string | null, now = Date.now()): boolean {
  if (!updatedAt) return false;

  const at = Date.parse(updatedAt);
  if (Number.isNaN(at)) return false;

  return now - at <= POSITION_FRESH_MS;
}

export function shouldPublishPosition(
  last: { lat: number; lng: number; at: number } | null,
  next: { lat: number; lng: number },
  now = Date.now(),
): boolean {
  if (!last) return true;
  if (now - last.at >= MIN_INTERVAL_MS) return true;

  return distanceMeters(last, next) >= MIN_MOVE_METERS;
}

/**
 * Vitesse au-delà de laquelle un déplacement n'est plus crédible, en km/h.
 *
 * Cent quatre-vingts : bien au-dessus de ce qu'on atteint à Gafsa, et bien en
 * dessous de ce qu'un saut GPS produit. Un relevé qui déplace de trois
 * kilomètres en deux secondes donne cinq mille quatre cents kilomètres à
 * l'heure — il n'y a pas de doute à avoir.
 */
const VITESSE_ABSURDE_KMH = 180;

/**
 * Ce relevé est-il croyable, sachant le précédent ?
 *
 * Le GPS d'un téléphone saute. En ville, entre deux immeubles, il se croit
 * régulièrement à plusieurs centaines de mètres — parfois à plusieurs
 * kilomètres — de sa position réelle, pendant une ou deux secondes, puis
 * revient. Suivi sans filtre, le marqueur du client part à l'autre bout de la
 * carte, la carte se recadre, et l'écran devient inutilisable au moment précis
 * où l'on marche vers son taxi.
 *
 * Deux garde-fous, et le second n'a de sens qu'avec le premier :
 *
 *   · un relevé dont la **précision annoncée** dépasse le seuil est écarté —
 *     le téléphone dit lui-même qu'il ne sait pas où il est ;
 *   · un déplacement qui suppose une **vitesse absurde** est écarté, parce
 *     qu'un saut d'antenne ressemble à s'y méprendre à un vrai déplacement,
 *     avec une bonne précision annoncée.
 *
 * Le premier relevé est toujours accepté : sans point de comparaison, il n'y a
 * rien à réfuter, et refuser laisserait l'écran sans position.
 */
export function positionPlausible(
  precedente: { lat: number; lng: number; at: number } | null,
  nouvelle: { lat: number; lng: number; at: number; precision?: number | null },
  precisionMax = 200,
): boolean {
  if (nouvelle.precision != null && nouvelle.precision > precisionMax) return false;
  if (!precedente) return true;

  const secondes = Math.max(1, (nouvelle.at - precedente.at) / 1000);
  const metres = distanceMeters(precedente, nouvelle);
  const kmh = (metres / secondes) * 3.6;

  return kmh <= VITESSE_ABSURDE_KMH;
}
