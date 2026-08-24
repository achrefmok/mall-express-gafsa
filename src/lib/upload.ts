"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Téléversement d'image vers Supabase Storage.
 *
 * Le chemin commence par l'identifiant du propriétaire : les policies de
 * storage.objects s'appuient sur ce premier segment pour autoriser l'écriture.
 * Les photos sont réduites côté navigateur avant l'envoi — un cliché de
 * téléphone pèse plusieurs mégaoctets, ce qui est inutile pour une vignette
 * et coûteux sur un réseau mobile.
 */

/**
 * Jusqu'où l'on accepte de réduire une photo, et à partir de quand.
 *
 * L'ancienne règle ramenait tout à 1600 pixels et réencodait en WebP à 0,82 —
 * y compris une photo déjà propre de 1800 pixels, qui perdait sa définition
 * pour rien. Le fichier du vendeur était détruit à l'entrée : le zoom plein
 * écran d'un téléphone à trois pixels par point réclame plus de trois mille
 * pixels, et il n'y en avait plus que mille six cents.
 *
 * Deux seuils désormais :
 *
 *   · en dessous de `MASTER`, **on ne touche à rien**. Le fichier part tel que
 *     le vendeur l'a pris, avec ses pixels et sa compression d'origine ;
 *   · au-delà, on réduit à `MASTER` — un cliché de vingt-quatre mégapixels ne
 *     sert à personne et coûte à tout le monde — mais à qualité élevée.
 *
 * Deux mille cinq cent soixante pixels tiennent le zoom d'un grand écran et
 * restent sous le mégaoctet en WebP. Aller à quatre mille triplerait le
 * stockage pour un gain que seul un pincement à quatre doigts révélerait.
 */
const MASTER = 2560;
const QUALITE = 0.92;

/** Au-delà, on réduit même une image petite : c'est le poids qui bloque. */
const POIDS_MAX = 6 * 1024 * 1024;

/**
 * En dessous, la photo restera floue quoi qu'on fasse à l'affichage.
 *
 * Ce n'est pas un refus : le vendeur qui n'a que cette image doit pouvoir la
 * publier. C'est un avertissement, et il n'a de sens que pour lui — dire à un
 * client qu'une photo est de mauvaise qualité ne lui donne aucun moyen d'agir.
 */
export const LARGEUR_CONSEILLEE = 900;

export interface ImagePreparee {
  blob: Blob;
  largeur: number;
  hauteur: number;
  /** Vrai si la définition restera insuffisante pour un affichage net. */
  basseDefinition: boolean;
  /** Vrai si l'on a rendu le fichier d'origine, sans le retoucher. */
  intacte: boolean;
}

/**
 * Prépare une image pour l'envoi — en préservant l'original chaque fois que
 * c'est possible.
 */
export async function prepareImage(file: File): Promise<ImagePreparee> {
  const brut: ImagePreparee = {
    blob: file,
    largeur: 0,
    hauteur: 0,
    basseDefinition: false,
    intacte: true,
  };

  // Les formats vectoriels n'ont pas de définition à mesurer, et rien à gagner
  // à passer par un canevas.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return brut;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Format que le navigateur ne sait pas décoder : on l'envoie tel quel
    // plutôt que de refuser une photo qui s'affichera peut-être ailleurs.
    return brut;
  }

  const { width, height } = bitmap;
  const cote = Math.max(width, height);
  const basseDefinition = Math.max(width, height) < LARGEUR_CONSEILLEE;

  /*
    Le cas de loin le plus fréquent : la photo tient dans les clous.

    On la laisse rigoureusement intacte. Réencoder ne ferait que retirer de
    l'information — même à qualité élevée, une seconde compression avec perte
    en enlève toujours.
  */
  if (cote <= MASTER && file.size <= POIDS_MAX) {
    bitmap.close();
    return { blob: file, largeur: width, hauteur: height, basseDefinition, intacte: true };
  }

  const echelle = Math.min(1, MASTER / cote);
  const w = Math.round(width * echelle);
  const h = Math.round(height * echelle);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { blob: file, largeur: width, hauteur: height, basseDefinition, intacte: true };
  }

  // Le lissage de qualité change vraiment quelque chose sur une réduction
  // importante : sans lui, les détails fins crénellent.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITE),
  );

  // Si la conversion n'a rien gagné, garder l'original : c'est toujours lui qui
  // porte le plus d'information.
  if (!blob || blob.size >= file.size) {
    return { blob: file, largeur: width, hauteur: height, basseDefinition, intacte: true };
  }

  return { blob, largeur: w, hauteur: h, basseDefinition, intacte: false };
}

/** Ancien nom, conservé pour les appels qui ne veulent que le fichier. */
export async function compressImage(file: File): Promise<Blob> {
  return (await prepareImage(file)).blob;
}

export interface UploadResult {
  path: string;
  publicUrl: string;
  /** Définition réelle du fichier envoyé. Zéro quand elle n'a pas pu être lue. */
  largeur: number;
  hauteur: number;
  /** À signaler au vendeur : cette photo restera floue une fois agrandie. */
  basseDefinition: boolean;
}

export async function uploadImage(
  bucket: "avatars" | "shop-assets" | "products" | "deals" | "live-covers",
  file: File,
): Promise<UploadResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentification requise");

  const prepare = await prepareImage(file);
  const body = prepare.blob;
  const extension = body.type === "image/webp" ? "webp" : (file.name.split(".").pop() ?? "jpg");
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: body.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    path,
    publicUrl,
    largeur: prepare.largeur,
    hauteur: prepare.hauteur,
    basseDefinition: prepare.basseDefinition,
  };
}

export async function deleteImage(
  bucket: "avatars" | "shop-assets" | "products" | "deals" | "live-covers",
  publicUrl: string,
): Promise<void> {
  const supabase = createClient();

  // Reconstituer le chemin de stockage depuis l'URL publique.
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  await supabase.storage.from(bucket).remove([path]);
}
