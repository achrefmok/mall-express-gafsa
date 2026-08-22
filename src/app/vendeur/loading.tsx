import { DashboardSkeleton } from "@/components/ui/skeletons";

/*
  Sans ce fichier, tout l'espace vendeur retombait sur le squelette racine — une
  grille de quatre vignettes produit — avant d'afficher un tableau de bord.
  Placé ici, il couvre le tableau, les produits, les commandes, les directs et
  les promotions : cinq écrans qui partagent la même charpente.
*/
export default function Loading() {
  return <DashboardSkeleton />;
}
