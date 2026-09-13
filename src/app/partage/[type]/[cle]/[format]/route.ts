import { carteDePartage, type FormatPartage } from "@/lib/og";
import {
  contenuBlackFriday,
  contenuBoutique,
  contenuChauffeur,
  contenuProduit,
} from "@/lib/og-contenus";
import type { ContenuPartage } from "@/lib/og";

export const runtime = "nodejs";

/**
 * Les images à publier : `/partage/{type}/{clé}/{post|story}`.
 *
 *   /partage/produit/<id ou adresse lisible>/post
 *   /partage/boutique/<slug>/story
 *   /partage/black-friday/campagne/post
 *   /partage/chauffeur/<id>/post
 *
 * Même contenu que l'aperçu de lien de la page, au format d'Instagram :
 * 1080 × 1350 pour un post, 1080 × 1920 pour une story. C'est
 * `BoutonPartage` qui les demande et les tend à la feuille de partage du
 * téléphone.
 *
 * Seuls ces deux formats sont servis, et seuls ces quatre types : une
 * adresse inventée répond 404 plutôt que de fabriquer une image — chaque
 * rendu coûte une conversion `sharp` et un rendu de page, et n'importe qui
 * peut appeler cette route.
 */
const FORMATS: ReadonlyArray<FormatPartage> = ["post", "story"];

const CONTENUS: Record<string, (cle: string) => Promise<ContenuPartage | null>> = {
  produit: contenuProduit,
  boutique: contenuBoutique,
  "black-friday": () => contenuBlackFriday(),
  chauffeur: contenuChauffeur,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; cle: string; format: string }> },
) {
  const { type, cle, format } = await params;
  const lire = CONTENUS[type];

  if (!lire || !FORMATS.includes(format as FormatPartage)) {
    return new Response("Introuvable", { status: 404 });
  }

  const contenu = await lire(decodeURIComponent(cle));
  if (!contenu) return new Response("Introuvable", { status: 404 });

  const image = await carteDePartage({ ...contenu, format: format as FormatPartage });

  /*
    Dix minutes : assez pour qu'une rafale de partages ne refabrique pas
    l'image à chaque fois, assez court pour qu'un prix Black Friday ne
    survive pas longtemps à la fin de la campagne.
  */
  image.headers.set("Cache-Control", "public, max-age=600, s-maxage=600, stale-while-revalidate=3600");
  return image;
}
