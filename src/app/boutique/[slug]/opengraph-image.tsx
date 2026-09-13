import { carteDePartage, TAILLE_OG } from "@/lib/og";
import { contenuBoutique } from "@/lib/og-contenus";

export const runtime = "nodejs";
export const alt = "Boutique sur Mall Express Gafsa";
export const size = TAILLE_OG;
export const contentType = "image/png";
export const revalidate = 3600;

/** L'aperçu d'une boutique partagée : son nom, sa catégorie, sa vitrine. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contenu = await contenuBoutique(slug);
  return carteDePartage(contenu ?? { titre: "Boutique introuvable", sousTitre: "Mall Express Gafsa" });
}
