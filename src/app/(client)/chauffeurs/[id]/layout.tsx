import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { lireChauffeur } from "./lire";

/**
 * Répondre 404 quand le chauffeur n'existe pas — vraiment 404.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi cette fiche n'est pas sous `/taxi`
 * ────────────────────────────────────────────────────────────────────────
 *
 * Elle y était, à `/taxi/profil/[id]`, et elle répondait 200 pour un
 * chauffeur inexistant. `(client)/taxi/loading.tsx` pose une frontière
 * Suspense au-dessus de tout ce qui vit sous `/taxi` : Next envoie la coque —
 * et son statut — avant que la page n'ait fini, et le `notFound()` ne peut
 * plus changer que le contenu. C'est le défaut que le commit « Un 404 servi
 * en 200 » a déjà corrigé pour les produits et les boutiques.
 *
 * Un layout dans le dossier `[id]` n'aurait pas suffi : il se serait trouvé
 * lui-même *à l'intérieur* de cette frontière. D'où `/chauffeurs/[id]`, sans
 * `loading.tsx` au-dessus, et le contrôle d'existence ici — le dernier
 * endroit où le statut est encore modifiable.
 *
 * L'enjeu est invisible à l'écran : une fiche de chauffeur retiré qui répond
 * « tout va bien » reste dans l'index des moteurs, et continue d'y envoyer des
 * clients vers quelqu'un qui ne travaille plus.
 */
export default async function ChauffeurLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await lireChauffeur(id))) notFound();
  return children;
}
