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

/**
 * Le logo bord à bord, recadré au carré.
 *
 * Les icônes d'application vont bord à bord : c'est le système qui
 * arrondit la vignette. Une marge ajoutée par nous se voit comme un cadre
 * pâle autour d'un logo rapetissé, au milieu d'icônes qui, elles, remplissent
 * leur case.
 */
const bordABord = (source: Buffer, taille: number, fond: Fond) =>
  sharp(source)
    .resize(taille, taille, { fit: "cover", position: "centre" })
    .flatten({ background: fond })
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Le logo centré sur sa vignette, avec la marge demandée. */
async function surVignette(source: Buffer, taille: number, part: number, fond: Fond) {
  const interieur = Math.round(taille * part);

  const logo = await sharp(source)
    .resize(interieur, interieur, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: { width: taille, height: taille, channels: 4, background: fond },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

type Fond = string | { r: number; g: number; b: number };

/**
 * La teinte du coin du logo, pour le reste de la vignette.
 *
 * La plupart des logos d'application portent déjà leur fond. Poser un violet
 * de marque derrière un tel logo dessine une couture : un carré de couleur
 * dans un autre. En reprenant la teinte de son coin, la marge se fond dans le
 * logo et la vignette paraît d'une seule pièce.
 *
 * Un logo détouré — coin transparent — n'a pas de fond à reprendre : celui-là
 * reçoit le violet de la marque, faute de quoi il disparaîtrait sur un écran
 * d'accueil clair.
 */
async function fondDuLogo(source: Buffer): Promise<Fond> {
  try {
    const { width = 0, height = 0 } = await sharp(source).metadata();
    const bord = Math.max(1, Math.round(Math.min(width, height) * 0.04));

    const { data } = await sharp(source)
      .extract({ left: 0, top: 0, width: bord, height: bord })
      .resize(1, 1)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (data[3] < 200) return COULEURS_MARQUE.violet;
    return { r: data[0], g: data[1], b: data[2] };
  } catch {
    return COULEURS_MARQUE.violet;
  }
}

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
      Trois cas, une seule règle : remplir la vignette.

      Un logo carré — ce que sont les logos d'application — occupe tout le
      carré. Il était posé à 84 % sur le fond clair de la marque, ce qui
      donnait sur l'écran d'accueil d'un iPhone une vignette blanche
      encadrant une image plus petite.

      Un logo nettement plus large que haut — une enseigne en bandeau —
      perdrait ses bords à ce recadrage. Celui-là garde sa marge, mais sur
      le violet de la marque : un fond clair disparaît sur un écran clair.

      L'icône « masquable » laisse vingt pour cent de marge : Android la
      découpe en cercle, en carré arrondi ou en goutte selon le téléphone,
      et tout ce qui dépasse de la zone sûre centrale est rogné.
    */
    const { width = 1, height = 1 } = await sharp(source).metadata();
    const carre = Math.abs(width / height - 1) <= 0.2;

    const fond = await fondDuLogo(source);

    const png = masquable
      ? await surVignette(source, taille, 0.6, fond)
      : carre
        ? await bordABord(source, taille, fond)
        : await surVignette(source, taille, 0.84, fond);

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
