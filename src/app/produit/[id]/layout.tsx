import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { identifiantProduit } from "./resoudre";

/**
 * Répondre 404 quand le produit n'existe pas — vraiment 404, pas seulement à
 * l'écran.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le défaut, invisible sans mesurer
 * ────────────────────────────────────────────────────────────────────────
 *
 * `notFound()` était bien appelé depuis la page, et la page « Page introuvable »
 * s'affichait correctement. Mais le serveur répondait **200**.
 *
 * La cause est le `loading.tsx` du même dossier. Il crée une frontière Suspense,
 * et Next envoie alors la coque de la page immédiatement — avec son code de
 * statut — avant même que le composant n'ait fini de s'exécuter. Quand
 * `notFound()` finit par être atteint, l'en-tête est parti depuis longtemps :
 * le contenu change, le statut ne peut plus.
 *
 * Personne ne l'aurait vu en regardant l'écran, qui affiche exactement ce qu'il
 * faut. Ce sont les moteurs de recherche qui en souffraient, et en silence :
 * Google indexe une page « introuvable » servie en 200 comme du contenu
 * valable, et **ne retire jamais de son index un produit supprimé** puisque son
 * adresse continue de répondre « tout va bien ».
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi ici
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une disposition s'exécute **avant** la frontière Suspense de `loading.tsx` :
 * c'est le dernier endroit où le statut est encore modifiable. La vérification
 * y remonte donc, et la page garde son squelette de chargement — on ne troque
 * pas un défaut contre un autre.
 *
 * Le coût est nul : `identifiantProduit` est mise en cache par React, et
 * l'appel de la page réutilise le résultat de celui-ci.
 */
export default async function ProductLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!(await identifiantProduit(id))) notFound();

  return children;
}
