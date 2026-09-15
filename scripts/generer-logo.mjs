/**
 * Le logo de l'application, dessiné en SVG et rendu en PNG.
 *
 *   node scripts/generer-logo.mjs
 *
 * Un sac de courses blanc marqué d'un « M », sur un carré aux coins très
 * arrondis en dégradé violet — les couleurs de la marque — avec la pastille
 * framboise des directs. Le fond fait partie du logo : il se lit donc aussi
 * bien sur fond clair que sur fond sombre.
 *
 * Tout est en formes, aucun texte : le rendu ne dépend d'aucune police
 * installée sur la machine qui le génère.
 *
 * Produit :
 *   public/brand/logo-mall-gafsa.png      1024 px, coins transparents
 *   public/brand/logo-mall-gafsa-512.png   512 px
 *   public/icons/icon-512.png, icon-192.png         (icônes de repli)
 *   public/icons/maskable-512.png                   (plein cadre, zone sûre)
 *   public/icons/apple-touch-icon.png               (plein cadre, 180 px)
 *   public/icons/icon.svg
 *
 * Les icônes de repli ne servent que si l'administration n'a pas choisi de
 * logo : `/brand-icon/*` compose celui de l'administration en priorité.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CONTENU = `
  <path d="M404 380 V340 a108 108 0 0 1 216 0 V380" fill="none" stroke="#ffffff" stroke-width="46" stroke-linecap="round"/>
  <path d="M318 372 H706 a34 34 0 0 1 33.9 31.4 L762 740 a44 44 0 0 1 -43.9 47 H305.9 a44 44 0 0 1 -43.9 -47 L284.1 403.4 A34 34 0 0 1 318 372 Z" fill="#ffffff"/>
  <path d="M400 702 V512 L512 626 L624 512 V702" fill="none" stroke="#6d4b8f" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="742" cy="322" r="52" fill="#e0556f" stroke="#ffffff" stroke-width="18"/>
`;

const DEFS = `
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8d64b9"/>
      <stop offset="1" stop-color="#46295f"/>
    </linearGradient>
    <linearGradient id="reflet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
`;

function svg({ pleinCadre }) {
  const fond = pleinCadre
    ? `<rect width="1024" height="1024" fill="url(#fond)"/><rect width="1024" height="1024" fill="url(#reflet)"/>`
    : `<rect x="48" y="48" width="928" height="928" rx="232" fill="url(#fond)"/>
       <rect x="48" y="48" width="928" height="928" rx="232" fill="url(#reflet)"/>`;
  // Plein cadre : le dessin rentre dans la zone sûre des icônes adaptatives (80 %).
  const dessin = pleinCadre
    ? `<g transform="translate(512 530) scale(0.74) translate(-512 -530)">${CONTENU}</g>`
    : CONTENU;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${DEFS}${fond}${dessin}</svg>`;
}

const rendre = (source, taille, sortie) =>
  sharp(Buffer.from(source)).resize(taille, taille).png({ compressionLevel: 9 }).toFile(sortie);

mkdirSync("public/brand", { recursive: true });
mkdirSync("public/icons", { recursive: true });

const arrondi = svg({ pleinCadre: false });
const plein = svg({ pleinCadre: true });

await rendre(arrondi, 1024, "public/brand/logo-mall-gafsa.png");
await rendre(arrondi, 512, "public/brand/logo-mall-gafsa-512.png");
await rendre(arrondi, 512, "public/icons/icon-512.png");
await rendre(arrondi, 192, "public/icons/icon-192.png");
await rendre(plein, 512, "public/icons/maskable-512.png");
await rendre(plein, 180, "public/icons/apple-touch-icon.png");
writeFileSync("public/icons/icon.svg", arrondi);

console.log("logo et icônes générés");
