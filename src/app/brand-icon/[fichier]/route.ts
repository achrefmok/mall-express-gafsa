import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { COULEURS_MARQUE, lireLogo } from "@/lib/brand";

/**
 * L'icône de l'application, fabriquée depuis le logo de l'administration.
 *
 *   /brand-icon/192.png
 *   /brand-icon/512.png
 *   /brand-icon/maskable-512.png
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi une route plutôt que des fichiers
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le logo se change depuis l'administration. Des fichiers dans
 * `public/icons/` resteraient ceux du jour de la construction : l'icône
 * installée sur les téléphones montrerait l'ancien dessin pour toujours, et
 * l'onglet du navigateur un troisième. Une route lit le logo à la source et
 * le met à la bonne taille à la demande.
 *
 * Le nom de fichier se termine par `.png` exprès : l'intergiciel ignore ces
 * adresses (voir `middleware.ts`), si bien qu'une icône ne déclenche pas de
 * rafraîchissement de session Supabase — le navigateur en demande plusieurs à
 * chaque ouverture.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Les tailles sont une liste fermée
 * ────────────────────────────────────────────────────────────────────────
 *
 * Accepter n'importe quelle taille, c'était offrir à qui le voulait de faire
 * redimensionner une image en 20 000 × 20 000 par le serveur, en boucle. On
 * ne sert que celles que les navigateurs demandent réellement.
 */

export const runtime = "nodejs";

const TAILLES = new Set([16, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await params;
  const correspondance = /^(maskable-)?(\d+)\.png$/.exec(fichier);

  if (!correspondance || !TAILLES.has(Number(correspondance[2]))) {
    return new NextResponse("Taille non prise en charge", { status: 404 });
  }

  const masquable = Boolean(correspondance[1]);
  const taille = Number(correspondance[2]);

  const repli = () =>
    NextResponse.redirect(
      new URL(taille <= 192 ? "/icons/icon-192.png" : "/icons/icon-512.png", request.url),
    );

  const logoUrl = await lireLogo();
  if (!logoUrl) return repli();

  let source: Buffer;
  try {
    const reponse = await fetch(logoUrl, { next: { revalidate: 3600, tags: ["brand"] } });
    if (!reponse.ok) return repli();
    source = Buffer.from(await reponse.arrayBuffer());
  } catch {
    return repli();
  }

  try {
    /*
      Deux compositions.

      L'icône ordinaire occupe presque tout le carré, sur fond de marque — un
      logo sur fond transparent disparaîtrait sur un écran d'accueil sombre.

      L'icône « masquable » laisse vingt pour cent de marge : Android la
      découpe en cercle, en carré arrondi ou en goutte selon le téléphone, et
      tout ce qui dépasse de la zone sûre centrale est rogné. Sans marge, les
      bords du logo partent avec.
    */
    const interieur = Math.round(taille * (masquable ? 0.6 : 0.84));

    const logo = await sharp(source)
      .resize(interieur, interieur, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const png = await sharp({
      create: {
        width: taille,
        height: taille,
        channels: 4,
        background: COULEURS_MARQUE.fond,
      },
    })
      .composite([{ input: logo, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        /*
          Une journée en cache, une semaine de grâce.

          Assez long pour qu'une icône ne soit pas refabriquée à chaque
          ouverture, assez court pour qu'un changement de logo se voie le
          lendemain sans intervention.
        */
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return repli();
  }
}
