import type { VariantImage, VariantImages } from "@/types/database";

/**
 * Ce qu'on montre pour une couleur, et ce qu'il reste à fabriquer.
 *
 * Une règle gouverne tout le fichier : **une photo réelle l'emporte toujours
 * sur une teinte fabriquée**. Elle vaut dans les deux sens — on ne fabrique
 * jamais par-dessus une vraie photo, et une vraie photo déposée plus tard
 * remplace la teinte sans qu'on ait à effacer quoi que ce soit.
 */

/* ─── Couleurs ─────────────────────────────────────────────────────────── */

/** Teinte d'une couleur CSS hexadécimale, en degrés. `null` si illisible. */
export function hueOf(color: string): number | null {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  // Un gris n'a pas de teinte : la faire tourner ne produirait rien.
  if (d === 0) return null;

  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  return (h * 60 + 360) % 360;
}

/**
 * De combien faire tourner la roue chromatique pour passer d'une couleur à
 * l'autre. `null` quand l'une des deux n'a pas de teinte — un noir, un blanc
 * ou un gris ne se dérive pas par rotation, et prétendre le contraire
 * produirait une image identique à la source.
 */
export function rotationBetween(from: string, to: string): number | null {
  const a = hueOf(from);
  const b = hueOf(to);
  if (a === null || b === null) return null;

  const delta = Math.round(b - a);
  return ((delta % 360) + 360) % 360;
}

/* ─── Lecture ──────────────────────────────────────────────────────────── */

/**
 * Les photos à faire défiler pour la couleur choisie.
 *
 * Sans couleur choisie, ou sans photo pour elle, on rend la galerie complète
 * du produit : mieux vaut montrer l'article que rien.
 */
export function galleryFor(
  images: string[],
  variantImages: VariantImages | null | undefined,
  selected: string | null,
): string[] {
  const entry = selected ? variantImages?.[selected] : undefined;
  if (!entry?.url) return images;

  /*
    La photo de la variante d'abord, les autres ensuite.

    On ne se limite pas à elle : les photos générales — le dos du vêtement, une
    vue portée, l'étiquette — restent utiles quelle que soit la couleur. Elles
    passent simplement après celle qui répond à la question posée.
  */
  return [entry.url, ...images.filter((url) => url !== entry.url)];
}

/** L'entrée de variante d'une couleur, si elle existe. */
export function variantOf(
  variantImages: VariantImages | null | undefined,
  color: string | null,
): VariantImage | null {
  if (!color) return null;
  return variantImages?.[color] ?? null;
}

/* ─── Fabrication ──────────────────────────────────────────────────────── */

export interface GenerationPlan {
  /** Couleur à produire. */
  color: string;
  /** Couleur dont on part. */
  from: string;
  /** Photo de départ. */
  sourceUrl: string;
  /** Rotation de teinte à appliquer, en degrés. */
  rotation: number;
}

/**
 * Ce qu'il reste à fabriquer, et à partir de quoi.
 *
 * On part de la couleur qui possède une **vraie** photo — jamais d'une teinte
 * déjà fabriquée, sans quoi les écarts s'accumuleraient de proche en proche.
 * À défaut de variante réelle, on prend la première photo du produit et on la
 * suppose représenter la première couleur déclarée : c'est l'usage constant
 * des vendeurs, et c'est la seule hypothèse disponible.
 *
 * Sont écartées : les couleurs qui ont déjà une photo — réelle *ou* fabriquée
 * et encore valable — et celles qu'une rotation ne saurait produire, c'est-à-dire
 * les neutres.
 */
export function planGeneration(
  colors: string[],
  images: string[],
  variantImages: VariantImages | null | undefined,
): GenerationPlan[] {
  if (colors.length < 2 || images.length === 0) return [];

  const current = variantImages ?? {};

  // La référence : une vraie photo de variante, sinon la première du produit.
  const realEntry = colors
    .map((c) => [c, current[c]] as const)
    .find(([, entry]) => entry && !entry.generated && entry.url);

  const fromColor = realEntry ? realEntry[0] : colors[0];
  const sourceUrl = realEntry ? realEntry[1]!.url : images[0];

  return colors.flatMap((color) => {
    if (color === fromColor) return [];

    const existing = current[color];
    // Une vraie photo n'est jamais remplacée ; une teinte déjà faite depuis la
    // même source non plus.
    if (existing && (!existing.generated || existing.from === fromColor)) return [];

    const rotation = rotationBetween(fromColor, color);
    if (rotation === null || rotation === 0) return [];

    return [{ color, from: fromColor, sourceUrl, rotation }];
  });
}

/**
 * Les teintes fabriquées devenues caduques : leur couleur a reçu une vraie
 * photo depuis, ou leur source a changé. À nettoyer au prochain
 * enregistrement — une image orpheline dans le stockage ne coûte rien à
 * l'affichage, mais elle s'accumule.
 */
export function staleGenerated(
  colors: string[],
  variantImages: VariantImages | null | undefined,
): string[] {
  const current = variantImages ?? {};
  return Object.entries(current)
    .filter(([color, entry]) => entry.generated && !colors.includes(color))
    .map(([color]) => color);
}
