/**
 * L'adresse d'une fiche produit, lisible par un humain et par un moteur.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le problème d'une adresse en identifiant nu
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une fiche vivait à `/produit/232811f0-9128-4b68-873e-b04fccfcd2b4`. Cette
 * adresse a deux défauts, et le second coûte plus cher que le premier :
 *
 *   · **elle ne dit rien.** Collée dans une conversation WhatsApp, elle ne
 *     donne aucune raison de cliquer — alors que c'est exactement ainsi qu'un
 *     lien circule à Gafsa ;
 *   · **elle ne pèse rien pour un moteur de recherche.** Les mots de l'adresse
 *     comptent dans le classement, et celle-ci n'en contient aucun.
 *
 * Elle devient `/produit/ecouteur-bluetooth-m19-232811f0`.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi l'identifiant reste, et pourquoi il est en dernier
 * ────────────────────────────────────────────────────────────────────────
 *
 * Ajouter une colonne `slug` à la table aurait demandé un changement de schéma,
 * un remplissage des lignes existantes, un index unique, et une décision sur ce
 * qui arrive quand deux vendeurs nomment leur article « Robe noire ». Tout cela
 * pour un gain que l'identifiant en fin d'adresse obtient déjà.
 *
 * Le préfixe est décoratif : il peut changer quand le vendeur renomme son
 * article, sans que le lien ne casse. Seuls les derniers caractères sont lus, et
 * ils suffisent — huit caractères d'un identifiant aléatoire ne se répètent pas
 * à l'échelle d'une ville.
 *
 * Les anciens liens en identifiant complet continuent donc de fonctionner :
 * c'est la même règle de lecture qui les résout.
 */

/** Une chaîne utilisable dans une adresse : minuscules, sans accent, sans espace. */
function sansAccent(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * L'adresse à publier.
 *
 * Le nom est tronqué à soixante caractères : au-delà, l'adresse devient
 * illisible dans une barre de navigation et se fait couper par les applications
 * de messagerie, ce qui casse le lien au moment précis où il devait circuler.
 */
export function lienProduit(produit: { id: string; name?: string | null }): string {
  const court = produit.id.slice(0, 8);
  const nom = sansAccent(produit.name ?? "").slice(0, 60).replace(/-+$/, "");

  return nom ? `/produit/${nom}-${court}` : `/produit/${produit.id}`;
}

/**
 * Retrouver le produit désigné par un segment d'adresse.
 *
 * Trois formes doivent être comprises, et elles le sont toutes par la même
 * règle — lire ce qui suit le dernier tiret :
 *
 *   · `232811f0-9128-4b68-873e-b04fccfcd2b4` — l'ancien lien, en identifiant
 *     complet. Le « dernier tiret » y découpe le dernier bloc, ce qui ne
 *     suffirait pas : on reconnaît donc d'abord la forme complète ;
 *   · `ecouteur-bluetooth-m19-232811f0` — la nouvelle ;
 *   · `232811f0` — le préfixe seul, si quelqu'un tronque.
 *
 * Retourne le préfixe à chercher en base, ou `null` si le segment ne ressemble
 * à rien.
 */
export function lireSegment(segment: string): { complet: string | null; prefixe: string | null } {
  const propre = decodeURIComponent(segment).trim().toLowerCase();

  // Un identifiant complet : on l'utilise tel quel, sans deviner.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(propre)) {
    return { complet: propre, prefixe: null };
  }

  /*
    Sinon, le dernier segment doit être une suite hexadécimale.

    Six caractères au minimum : en dessous, la probabilité de désigner deux
    produits à la fois cesse d'être négligeable, et une fiche qui s'ouvre au
    hasard est pire qu'une page introuvable.
  */
  const dernier = propre.split("-").pop() ?? "";
  if (/^[0-9a-f]{6,32}$/.test(dernier)) return { complet: null, prefixe: dernier };

  return { complet: null, prefixe: null };
}

/**
 * L'intervalle d'identifiants que désigne un préfixe de huit caractères.
 *
 * PostgREST ne sait pas appliquer un `like` sur une colonne `uuid` — Postgres
 * n'a tout simplement pas cet opérateur pour ce type, et la requête échouerait.
 * Mais un `uuid` se compare, et un préfixe décrit exactement un intervalle : de
 * `232811f0-0000-…-000000000000` à `232811f0-ffff-…-ffffffffffff`.
 *
 * Une comparaison d'intervalle utilise l'index de clé primaire, là où un `like`
 * sur une colonne convertie en texte aurait imposé un parcours complet de la
 * table à chaque ouverture de fiche.
 */
export function intervalleDe(prefixe: string): { debut: string; fin: string } | null {
  if (!/^[0-9a-f]{8}$/.test(prefixe)) return null;

  return {
    debut: `${prefixe}-0000-0000-0000-000000000000`,
    fin: `${prefixe}-ffff-ffff-ffff-ffffffffffff`,
  };
}
