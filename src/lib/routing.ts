import type { Point } from "./taxi-match";

/**
 * Le trajet par la route, et non le vol d'oiseau.
 *
 * Une ligne droite entre deux points ment sur ce qui compte : à Gafsa, l'oued
 * et la voie ferrée coupent la ville, et deux adresses distantes de trois
 * kilomètres à vol d'oiseau peuvent en demander six par la route. Un client qui
 * lit « 3,5 km · 8 min » et paie une course de six kilomètres se croit floué —
 * par le chauffeur, qui n'y est pour rien.
 *
 * **Le service : OSRM, dans son instance de démonstration publique.** Aucune
 * clé, aucun compte, aucune facturation — les mêmes raisons qui ont fait
 * choisir OpenStreetMap pour les tuiles. C'est un serveur de démonstration : il
 * n'offre aucun engagement de disponibilité, et il faut donc que l'écran
 * fonctionne sans lui. C'est le cas — à défaut d'itinéraire, on retombe sur la
 * ligne droite et on le **dit**, plutôt que de laisser croire à un calcul
 * routier qui n'a pas eu lieu.
 */

const OSRM = "https://router.project-osrm.org/route/v1/driving";

/** Au-delà, on renonce : mieux vaut la ligne droite qu'un écran qui attend. */
const DELAI_MS = 6000;

export interface Itineraire {
  /** La suite de points qui suit les routes. */
  points: Point[];
  metres: number;
  minutes: number;
  /** Vrai quand le tracé vient d'un vrai calcul routier. */
  routier: boolean;
}

/*
  Les itinéraires déjà calculés, gardés le temps de la visite.

  Un client qui compare trois chauffeurs pour le même trajet ne doit pas
  déclencher trois fois le même calcul. La clé arrondit les coordonnées à
  quatre décimales — une dizaine de mètres — parce qu'un GPS qui tremble de
  trois mètres ne change pas d'itinéraire.
*/
const memoire = new Map<string, Itineraire>();

const cle = (a: Point, b: Point) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

/**
 * Le chemin routier entre deux points.
 *
 * Rend toujours quelque chose d'affichable : le tracé routier s'il a pu être
 * obtenu, la ligne droite sinon, avec `routier: false` pour que l'écran puisse
 * le signaler.
 */
export async function itineraire(depart: Point, destination: Point): Promise<Itineraire> {
  const memo = memoire.get(cle(depart, destination));
  if (memo) return memo;

  const droite: Itineraire = {
    points: [depart, destination],
    metres: 0,
    minutes: 0,
    routier: false,
  };

  try {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);

    // OSRM attend longitude puis latitude — l'ordre inverse de l'usage courant,
    // et l'erreur la plus fréquente avec ce service : elle donne un itinéraire
    // parfaitement tracé, quelque part en Somalie.
    const url =
      `${OSRM}/${depart.lng},${depart.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;

    const reponse = await fetch(url, { signal: controleur.signal });
    clearTimeout(minuteur);

    if (!reponse.ok) return droite;

    const data = (await reponse.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }>;
    };

    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route || !route.geometry?.coordinates?.length) return droite;

    const resultat: Itineraire = {
      points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      metres: Math.round(route.distance),
      // OSRM rend des secondes, calculées sur des vitesses libres. En ville, on
      // roule moins vite que ne le suppose une carte : une marge d'un quart
      // colle mieux à ce que le chauffeur annoncera.
      minutes: Math.max(1, Math.round((route.duration / 60) * 1.25)),
      routier: true,
    };

    memoire.set(cle(depart, destination), resultat);
    return resultat;
  } catch {
    // Réseau coupé, service indisponible, délai dépassé : la ligne droite reste
    // une information, à condition de ne pas la faire passer pour autre chose.
    return droite;
  }
}
