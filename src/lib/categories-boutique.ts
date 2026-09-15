/**
 * Les catégories qu'une boutique peut donner à ses produits.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le « mapping » type de boutique → catégories, sans liste écrite en dur
 * ────────────────────────────────────────────────────────────────────────
 *
 * Il existe déjà en base : l'arbre des catégories. « Animaux » a pour enfants
 * Chiens, Chats, Oiseaux… ; « Mode » a Femme, Homme, Enfant… Le type d'une
 * boutique, c'est la famille de sa catégorie principale et de ses
 * « catégories vendues » (réglages de la boutique).
 *
 * Une boutique d'électronique voit donc la famille Électronique — et jamais
 * Chats ou Toilettage —, sans qu'aucune correspondance ne soit maintenue à la
 * main : une catégorie ajoutée depuis l'administration se range d'elle-même
 * dans sa famille.
 *
 * Trois règles de compatibilité :
 *
 *   · une boutique qui n'a encore déclaré aucun type voit **toutes** les
 *     catégories, comme avant — ranger ses produits ne doit pas devenir
 *     impossible parce que les réglages sont incomplets ;
 *   · la catégorie déjà portée par un produit reste toujours proposée, même
 *     hors de la famille : ouvrir un ancien produit ne doit ni effacer ni
 *     cacher sa catégorie ;
 *   · déclarer une sous-catégorie (« Femme ») ouvre toute sa famille
 *     (« Mode ») : on vend rarement un seul rayon.
 *
 * Pur, sans base ni navigateur : testé par `categories-boutique.test.ts`.
 */

export interface NoeudCategorie {
  id: string;
  parent_id: string | null;
  sort_order: number | null;
}

const parOrdre = (a: NoeudCategorie, b: NoeudCategorie) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/** La catégorie racine d'une catégorie : elle-même si elle n'a pas de parent. */
export function racineDe<T extends NoeudCategorie>(id: string, toutes: T[]): string | null {
  const categorie = toutes.find((c) => c.id === id);
  if (!categorie) return null;
  return categorie.parent_id ?? categorie.id;
}

/**
 * Chaque parent suivi de ses enfants, dans l'ordre de l'administration.
 *
 * Une catégorie dont le parent n'est pas dans la liste est traitée comme un
 * parent : elle ne disparaît pas de l'affichage.
 */
export function ordonnerParFamille<T extends NoeudCategorie>(liste: T[]): T[] {
  const presents = new Set(liste.map((c) => c.id));
  const tetes = liste.filter((c) => !c.parent_id || !presents.has(c.parent_id)).sort(parOrdre);

  const resultat: T[] = [];
  for (const tete of tetes) {
    resultat.push(tete);
    resultat.push(...liste.filter((c) => c.parent_id === tete.id).sort(parOrdre));
  }
  return resultat;
}

export function categoriesPourBoutique<T extends NoeudCategorie>(
  toutes: T[],
  typesBoutique: Array<string | null | undefined>,
  categorieActuelle?: string | null,
): { categories: T[]; filtre: boolean } {
  const racines = new Set(
    typesBoutique
      .filter((id): id is string => Boolean(id))
      .map((id) => racineDe(id, toutes))
      .filter((id): id is string => Boolean(id)),
  );

  if (racines.size === 0) {
    return { categories: ordonnerParFamille(toutes), filtre: false };
  }

  const retenues = toutes.filter(
    (c) => racines.has(c.id) || (c.parent_id !== null && racines.has(c.parent_id)),
  );

  if (categorieActuelle && !retenues.some((c) => c.id === categorieActuelle)) {
    const actuelle = toutes.find((c) => c.id === categorieActuelle);
    if (actuelle) retenues.push(actuelle);
  }

  return { categories: ordonnerParFamille(retenues), filtre: true };
}
