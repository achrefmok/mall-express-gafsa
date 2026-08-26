import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Répondre 404 quand la boutique n'existe pas — vraiment 404.
 *
 * Même défaut que sur les fiches produit, même cause : le `loading.tsx` de ce
 * dossier crée une frontière Suspense, Next envoie la coque avec son statut
 * avant que le composant n'ait fini, et le `notFound()` de la page ne pouvait
 * plus que changer le contenu. Le serveur répondait 200 sur l'adresse d'une
 * boutique inexistante ou non approuvée.
 *
 * L'enjeu est le même, et il est entièrement invisible à l'écran : une boutique
 * fermée dont l'adresse répond « tout va bien » ne quitte jamais l'index de
 * Google, et continue d'envoyer des clients vers une page vide.
 *
 * Une disposition s'exécute avant cette frontière. C'est le dernier endroit où
 * le statut est encore modifiable.
 */

/*
  La même lecture que la page, mise en cache pour la durée de la requête.

  Sans le cache de React, vérifier l'existence ici doublerait la lecture de la
  boutique à chaque visite. Avec, le second appel ne coûte rien.
*/
const boutiqueExiste = cache(async (slug: string): Promise<boolean> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("shops")
    .select("id")
    .eq("slug", slug)
    // Une boutique en attente de vérification n'est pas publique : elle doit
    // répondre 404 comme si elle n'existait pas, et non exposer sa fiche.
    .eq("status", "approved")
    .maybeSingle();

  return Boolean(data);
});

export default async function ShopLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!(await boutiqueExiste(slug))) notFound();

  return children;
}
