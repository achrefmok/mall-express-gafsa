/**
 * Les métiers du service SOS.
 *
 * Cette liste est la copie exacte de la contrainte `check` de
 * `sos_providers.trade`. Le doublon est assumé : la base doit refuser une valeur
 * inventée même si la requête ne vient pas de l'application, et l'interface doit
 * pouvoir proposer des choix sans interroger la base à chaque affichage.
 *
 * En ajouter un se fait en deux endroits — ici, et dans une migration. Si l'on
 * oublie la seconde, le premier enregistrement échoue immédiatement : la base
 * reste l'autorité, ce fichier n'en est que le reflet.
 *
 * Les libellés vivent dans le dictionnaire (`t.sos.trades`), pas ici : ils
 * s'affichent en français comme en arabe.
 */
export const SOS_TRADES = [
  "mecanicien",
  "electricien",
  "plombier",
  "remorquage",
  "transporteur",
  "serrurier",
  "pneumatique",
  "climatisation",
] as const;

export type SosTrade = (typeof SOS_TRADES)[number];

export function isSosTrade(value: string): value is SosTrade {
  return (SOS_TRADES as readonly string[]).includes(value);
}
