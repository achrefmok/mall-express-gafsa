import { carteDePartage, TAILLE_OG } from "@/lib/og";
import { contenuBlackFriday } from "@/lib/og-contenus";

export const runtime = "nodejs";
export const alt = "Black Friday — Mall Express Gafsa";
export const size = TAILLE_OG;
export const contentType = "image/png";
// Dix minutes : l'image change au début et à la fin de la campagne.
export const revalidate = 600;

/** L'aperçu du Black Friday : la plus forte remise en cours, ou la date. */
export default async function Image() {
  return carteDePartage(await contenuBlackFriday());
}
