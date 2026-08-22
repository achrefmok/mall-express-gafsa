/**
 * Remplissage d'un gabarit : « Photo {i} sur {n} » → « Photo 2 sur 5 ».
 *
 * Cette fonction vivait dans `dictionaries.ts`, et c'était son seul défaut :
 * une vingtaine de composants client l'importaient, et ce module exporte les
 * deux dictionnaires — quarante-huit kilo-octets de français *et* d'arabe. Un
 * client francophone téléchargeait donc tout l'arabe, et l'inverse, sur un
 * marché où la donnée mobile se paie.
 *
 * Isolée ici, elle ne traîne plus rien derrière elle.
 *
 * Une clé absente laisse le gabarit intact plutôt que d'écrire « undefined » :
 * en cas d'oubli, mieux vaut afficher « Photo {i} sur 5 », qui se remarque et se
 * corrige, qu'une phrase fausse qui passe inaperçue.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
