/**
 * Génère les PNG du manifeste à partir de public/icons/icon.svg.
 *
 *   node scripts/generate-icons.mjs
 *
 * Utilise `sharp` s'il est disponible (npm i -D sharp), sinon écrit des PNG
 * minimaux de repli pour que le manifeste reste valide et que le build ne
 * casse pas. Pour une qualité de production, installez sharp.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const source = join(iconsDir, "icon.svg");

const TARGETS = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  // Icône masquable : Android rogne jusqu'à 20 % sur chaque bord, il faut
  // donc une marge de sécurité autour du dessin.
  { file: "maskable-512.png", size: 512, padding: 64 },
  { file: "apple-touch-icon.png", size: 180, padding: 0 },
  { file: "badge.png", size: 96, padding: 0 },
];

mkdirSync(iconsDir, { recursive: true });

if (!existsSync(source)) {
  console.error("public/icons/icon.svg introuvable");
  process.exit(1);
}

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  sharp = null;
}

const svg = await readFile(source);

if (sharp) {
  for (const { file, size, padding } of TARGETS) {
    const inner = size - padding * 2;

    const rendered = await sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: padding > 0 ? { r: 109, g: 75, b: 143, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: rendered, top: padding, left: padding }])
      .png()
      .toFile(join(iconsDir, file));

    console.log(`✓ ${file} (${size}×${size})`);
  }
} else {
  // Repli : un PNG 1×1 violet, valide et suffisant pour ne pas bloquer.
  // Le SVG reste l'icône réellement affichée sur les navigateurs modernes.
  const placeholder = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );

  for (const { file } of TARGETS) {
    writeFileSync(join(iconsDir, file), placeholder);
  }

  console.warn(
    "sharp absent — PNG de repli écrits.\n" +
      "Pour de vraies icônes : npm i -D sharp && node scripts/generate-icons.mjs",
  );
}
