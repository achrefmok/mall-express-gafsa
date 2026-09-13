import { carteDePartage, TAILLE_OG } from "@/lib/og";
import { contenuChauffeur } from "@/lib/og-contenus";

export const runtime = "nodejs";
export const alt = "Chauffeur de taxi sur Mall Express Gafsa";
export const size = TAILLE_OG;
export const contentType = "image/png";
export const revalidate = 600;

/** L'aperçu d'une fiche chauffeur partagée : photo, voiture, note. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contenu = await contenuChauffeur(id);
  return carteDePartage(contenu ?? { titre: "Chauffeur introuvable", sousTitre: "Mall Express Gafsa" });
}
