import { carteDePartage, TAILLE_OG } from "@/lib/og";
import { contenuProduit } from "@/lib/og-contenus";

export const runtime = "nodejs";
export const alt = "Produit sur G-Mall";
export const size = TAILLE_OG;
export const contentType = "image/png";
export const revalidate = 600;

/**
 * L'aperçu d'un produit partagé.
 *
 * Le contenu vient de `og-contenus`, comme les images Instagram de
 * `/partage` : le prix Black Friday pendant la campagne, le prix barré
 * habituel sinon.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contenu = await contenuProduit(id);
  return carteDePartage(contenu ?? { titre: "Produit introuvable", sousTitre: "G-Mall" });
}
