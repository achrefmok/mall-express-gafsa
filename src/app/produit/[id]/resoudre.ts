import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { intervalleDe, lireSegment } from "@/lib/product-url";

/**
 * L'identifiant du produit désigné par un segment d'adresse.
 *
 * Le segment prend trois formes, et cette fonction est le seul endroit qui ait
 * à le savoir :
 *
 *   · `232811f0-9128-4b68-873e-b04fccfcd2b4` — l'ancien lien, en identifiant
 *     complet, qui doit continuer de fonctionner indéfiniment : il circule
 *     depuis des mois dans des conversations et des favoris ;
 *   · `ecouteur-bluetooth-m19-232811f0` — la nouvelle, lisible ;
 *   · `232811f0` — le préfixe seul, si une application de messagerie a tronqué.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi elle rend un identifiant, et non le produit
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une première version prenait la liste des colonnes en paramètre et rendait la
 * ligne. C'était plus court d'un aller-retour et **cela cassait le typage** :
 * une liste de colonnes reçue sous forme de chaîne à l'exécution ne peut plus
 * être analysée, et le client Supabase rendait alors un type d'erreur générique
 * au lieu de la forme du produit. Toute la page perdait ses garanties pour
 * économiser une requête sur `id`.
 *
 * Elle ne rend donc qu'un identifiant, et les requêtes de la page restent
 * écrites — et vérifiées — telles quelles.
 *
 * Le cas le plus fréquent ne coûte rien : un identifiant complet est reconnu
 * sans toucher à la base.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi elle est mise en cache
 * ────────────────────────────────────────────────────────────────────────
 *
 * Elle est appelée trois fois par ouverture de fiche : par la disposition, qui
 * décide s'il faut répondre 404 ; par `generateMetadata` ; puis par la page.
 * Le cache de React les ramène à un seul appel pour la durée de la requête,
 * exactement comme `getProfile` ailleurs dans le projet.
 */
export const identifiantProduit = cache(async (segment: string): Promise<string | null> => {
  const cle = lireSegment(segment);
  if (cle.complet) return cle.complet;

  const intervalle = cle.prefixe ? intervalleDe(cle.prefixe.slice(0, 8)) : null;
  if (!intervalle) return null;

  /*
    Un préfixe décrit un intervalle d'identifiants, pas un motif.

    PostgREST ne sait pas appliquer un `like` sur une colonne `uuid` — Postgres
    n'a pas cet opérateur pour ce type. La comparaison d'intervalle, elle,
    utilise l'index de clé primaire, là où un `like` sur une conversion en texte
    aurait imposé un parcours complet de la table à chaque ouverture de fiche.

    `limit(1)` plutôt qu'une ligne unique attendue : deux produits partageant
    les huit mêmes premiers caractères sont improbables mais pas impossibles, et
    une fiche qui refuse de s'ouvrir vaut moins que la première des deux.
  */
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id")
    .gte("id", intervalle.debut)
    .lte("id", intervalle.fin)
    .limit(1);

  return data?.[0]?.id ?? null;
});
