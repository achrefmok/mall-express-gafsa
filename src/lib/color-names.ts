/**
 * Nommer un coloris à partir de son code hexadécimal.
 *
 * La base ne stocke que `#b51a00` : c'est ce qu'un sélecteur de couleur produit,
 * et demander en plus un nom à chaque vendeur pour chaque coloris ferait
 * abandonner la moitié d'entre eux au troisième champ. Mais « #b51a00 » ne se
 * lit pas, ne se prononce pas au téléphone et ne se retient pas — or c'est
 * exactement ce qu'un client doit pouvoir faire pour commander un article dans
 * la bonne couleur.
 *
 * On approche donc le nom : la teinte de référence la plus proche l'emporte.
 * C'est une approximation assumée — un `#b51a00` s'appellera « rouge » et non
 * « rouge brique » — mais elle est stable, elle ne ment pas, et elle vaut
 * infiniment mieux qu'un code à six chiffres.
 *
 * La distance se calcule sur les trois canaux pondérés par la sensibilité de
 * l'œil : le vert compte pour plus de la moitié, le bleu pour un dixième. Une
 * distance euclidienne brute rangeait des bleus sombres avec des marrons.
 */

import type { Dictionary } from "./i18n/dictionaries";

/** Les teintes de référence, et la clé de leur nom dans le dictionnaire. */
const REPERES: ReadonlyArray<readonly [key: keyof Dictionary["colorNames"], hex: string]> = [
  ["black", "#000000"],
  ["white", "#ffffff"],
  ["grey", "#8a8a8a"],
  ["beige", "#e3d5b8"],
  ["brown", "#6b4423"],
  ["red", "#d02020"],
  ["burgundy", "#6d1028"],
  ["pink", "#f08cb4"],
  ["orange", "#f07818"],
  ["yellow", "#f0d020"],
  ["olive", "#7a7a20"],
  ["green", "#2e9440"],
  ["turquoise", "#20b8b0"],
  ["blue", "#1858d8"],
  ["navy", "#101c50"],
  ["purple", "#7a2e9e"],
];

function canaux(hex: string): [number, number, number] | null {
  const brut = hex.trim().replace(/^#/, "");
  const plein =
    brut.length === 3
      ? brut
          .split("")
          .map((c) => c + c)
          .join("")
      : brut;

  if (!/^[0-9a-fA-F]{6}$/.test(plein)) return null;

  return [
    parseInt(plein.slice(0, 2), 16),
    parseInt(plein.slice(2, 4), 16),
    parseInt(plein.slice(4, 6), 16),
  ];
}

/**
 * Le nom du coloris le plus proche, dans la langue en cours.
 *
 * Rend `null` quand le code est illisible : mieux vaut afficher le rang du
 * coloris que d'inventer un nom sur des données qu'on n'a pas su lire.
 */
export function colorName(hex: string, t: Dictionary): string | null {
  const cible = canaux(hex);
  if (!cible) return null;

  let meilleur = REPERES[0];
  let ecart = Infinity;

  for (const repere of REPERES) {
    const ref = canaux(repere[1]);
    if (!ref) continue;

    // Pondération de la sensibilité de l'œil : le vert domine, le bleu compte
    // peu. Sans elle, un bleu marine se rangeait avec les marrons.
    const d =
      0.3 * (cible[0] - ref[0]) ** 2 +
      0.59 * (cible[1] - ref[1]) ** 2 +
      0.11 * (cible[2] - ref[2]) ** 2;

    if (d < ecart) {
      ecart = d;
      meilleur = repere;
    }
  }

  return t.colorNames[meilleur[0]];
}
