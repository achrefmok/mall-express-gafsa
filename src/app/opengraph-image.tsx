import { carteDePartage, TAILLE_OG } from "@/lib/og";

/*
  L'image de partage par défaut, pour toute page qui n'a pas la sienne.

  Sans elle, un lien vers l'accueil, le marketplace ou les services arrivait
  sur WhatsApp en simple ligne bleue, sans image : l'aperçu que les autres
  sites affichent, le nôtre ne l'avait pas.
*/
export const runtime = "nodejs";
export const alt = "Mall Express Gafsa";
export const size = TAILLE_OG;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  return carteDePartage({
    bandeau: "GAFSA",
    titre: "Les boutiques du mall, en ligne",
    sousTitre: "Marketplace · ventes en direct · bons plans · taxi · services",
  });
}
