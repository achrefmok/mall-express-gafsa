/**
 * Un numéro de téléphone tunisien, vérifié et mis en forme.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi « au moins six caractères » ne suffisait pas
 * ────────────────────────────────────────────────────────────────────────
 *
 * C'était la règle : `phone.length < 6` et rien d'autre. Elle acceptait
 * « 123456 », « abcdef » et « ????? ? » — et elle les acceptait aux endroits
 * qui comptent le plus, puisque le numéro est le seul moyen de joindre un
 * chauffeur de taxi, un dépanneur ou une boutique.
 *
 * Un numéro faux ne se remarque pas au moment de la saisie. Il se remarque le
 * jour où quelqu'un cherche un plombier à vingt-trois heures.
 *
 * ────────────────────────────────────────────────────────────────────────
 * La règle tunisienne
 * ────────────────────────────────────────────────────────────────────────
 *
 * Huit chiffres, et le premier dit de quoi il s'agit :
 *
 *   · 2, 4, 5, 9 — mobile (Ooredoo, Orange, Tunisie Télécom) ;
 *   · 3, 7       — fixe ;
 *   · 8          — numéros spéciaux, verts et payants.
 *
 * L'indicatif +216 est accepté, avec ou sans le `+`, avec ou sans `00`. Les
 * espaces, points, tirets et parenthèses sont ignorés : les gens écrivent
 * « 98 123 456 » et ils ont raison.
 *
 * Un numéro étranger est refusé. C'est délibéré : la plateforme sert une ville,
 * et un numéro que personne ne pourra composer d'ici vaut moins qu'un champ
 * vide, qui au moins ne promet rien.
 */

/** Ce qui peut commencer un numéro tunisien. */
const PREFIXES = ["2", "3", "4", "5", "7", "8", "9"];

/** Les huit chiffres, sans indicatif ni séparateur. `null` si le numéro est invalide. */
export function numeroNormalise(brut: string | null | undefined): string | null {
  if (!brut) return null;

  // Tout ce qui n'est pas un chiffre disparaît, le `+` compris : il ne porte
  // aucune information que l'indicatif ne porte déjà.
  const chiffres = brut.replace(/[^0-9]/g, "");
  if (chiffres.length === 0) return null;

  let corps = chiffres;

  /*
    Retirer l'indicatif, sous ses trois formes.

    L'ordre compte : « 00216 » contient « 216 », et tester le plus long d'abord
    évite de confondre le préfixe international avec le début du numéro.
  */
  if (corps.startsWith("00216")) corps = corps.slice(5);
  else if (corps.startsWith("216") && corps.length === 11) corps = corps.slice(3);

  if (corps.length !== 8) return null;
  if (!PREFIXES.includes(corps[0])) return null;

  return corps;
}

/** Ce numéro est-il composable depuis la Tunisie ? */
export function numeroValide(brut: string | null | undefined): boolean {
  return numeroNormalise(brut) !== null;
}

/**
 * Le numéro tel qu'on l'affiche : « 98 123 456 ».
 *
 * Groupé par deux puis par trois, comme on le lit à voix haute et comme il est
 * imprimé sur les cartes de visite. Un numéro invalide ressort tel quel plutôt
 * que d'être effacé — les données déjà en base sont ce qu'elles sont, et une
 * chaîne vide serait pire qu'un numéro douteux affiché honnêtement.
 */
export function numeroLisible(brut: string | null | undefined): string {
  const corps = numeroNormalise(brut);
  if (!corps) return brut?.trim() ?? "";

  return `${corps.slice(0, 2)} ${corps.slice(2, 5)} ${corps.slice(5)}`;
}

/**
 * La forme à composer, pour un lien `tel:`.
 *
 * Avec l'indicatif : un téléphone qui compose depuis l'étranger, ou dont la
 * carte SIM n'est pas tunisienne, échouerait sans lui.
 */
export function numeroAppelable(brut: string | null | undefined): string {
  const corps = numeroNormalise(brut);
  return corps ? `+216${corps}` : (brut?.replace(/\s/g, "") ?? "");
}

/** Le message à montrer quand la saisie est refusée. Une phrase, pas un code. */
export const NUMERO_INVALIDE =
  "Numéro invalide. Un numéro tunisien compte huit chiffres — par exemple 98 123 456.";
