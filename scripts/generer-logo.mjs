/**
 * Le logo de l'application, dessiné en SVG et rendu en PNG.
 *
 *   node scripts/generer-logo.mjs
 *
 * Un sac de courses blanc portant le « G » de Gafsa, sur un carré en dégradé
 * violet — les couleurs de la marque.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi une forme, et rien d'autre
 * ────────────────────────────────────────────────────────────────────────
 *
 * Sur un écran d'accueil, une icône fait soixante pixels de côté. Un nom
 * écrit dedans n'y est plus qu'une barbouille grise : Facebook n'y met qu'un
 * « f », TikTok qu'une note. D'où une seule forme, épaisse, sans texte et
 * sans ombre portée — et le fond fait partie du dessin, pour que le logo
 * tienne aussi bien sur un écran clair que sombre.
 *
 * Le dessin va bord à bord : c'est le système qui arrondit la vignette,
 * chacun à sa façon. L'arrondir nous-mêmes en donnerait deux.
 *
 * Tout est en formes, aucun texte : le rendu ne dépend d'aucune police
 * installée sur la machine qui le génère.
 *
 * Produit :
 *   public/brand/app-icon.png             1024 px, plein cadre — le logo
 *   public/brand/app-icon-512.png          512 px
 *   public/icons/icon-512.png, icon-192.png         (icônes de repli)
 *   public/icons/maskable-512.png                   (zone sûre d'Android)
 *   public/icons/apple-touch-icon.png               (180 px)
 *   public/icons/icon.svg
 *
 * Les icônes de repli ne servent que si l'administration n'a pas choisi de
 * logo : `/brand-icon/*` compose celui de l'administration en priorité.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** Un point du cercle, en degrés, l'axe des ordonnées vers le bas. */
const point = (cx, cy, r, angle) => [
  cx + r * Math.cos((angle * Math.PI) / 180),
  cy + r * Math.sin((angle * Math.PI) / 180),
];
const n = (v) => v.toFixed(1);

/**
 * Le « G », construit au compas plutôt qu'écrit.
 *
 * Un arc ouvert en haut à droite, fermé par une barre horizontale : la
 * lettre tient sans police, et ses pleins gardent la même épaisseur que
 * l'anse du sac — deux traits de même poids font un dessin d'une pièce.
 */
function lettreG({ cx, cy, rayon, epaisseur, couleur }) {
  const [xDepart, yDepart] = point(cx, cy, rayon, -48);
  const [xFin, yFin] = point(cx, cy, rayon, 0);

  return `<g fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="round">
    <path d="M ${n(xDepart)} ${n(yDepart)} A ${rayon} ${rayon} 0 1 0 ${n(xFin)} ${n(yFin)}"/>
    <path d="M ${n(xFin)} ${n(yFin)} H ${n(cx + rayon - epaisseur * 1.6)}"/>
  </g>`;
}

const SAC = `
  <path d="M404 380 V340 a108 108 0 0 1 216 0 V380" fill="none" stroke="#ffffff" stroke-width="46" stroke-linecap="round"/>
  <path d="M318 372 H706 a34 34 0 0 1 33.9 31.4 L762 740 a44 44 0 0 1 -43.9 47 H305.9 a44 44 0 0 1 -43.9 -47 L284.1 403.4 A34 34 0 0 1 318 372 Z" fill="#ffffff"/>`;

const MARQUE = SAC + lettreG({ cx: 512, cy: 585, rayon: 112, epaisseur: 48, couleur: "#6d4b8f" });

const DEFS = `
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8d64b9"/>
      <stop offset="1" stop-color="#46295f"/>
    </linearGradient>
    <linearGradient id="reflet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

/**
 * `echelle` dit quelle part du carré le dessin occupe.
 *
 * 1,24 pour l'icône : le sac remplit la vignette, comme le « f » de Facebook
 * remplit la sienne. 0,92 pour la variante masquable d'Android, qui découpe
 * l'icône en cercle, en carré arrondi ou en goutte selon le téléphone — tout
 * ce qui déborde de la zone sûre centrale part au rognage.
 */
function svg(echelle) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${DEFS}
  <rect width="1024" height="1024" fill="url(#fond)"/>
  <rect width="1024" height="1024" fill="url(#reflet)"/>
  <g transform="translate(512 545) scale(${echelle}) translate(-512 -545)">${MARQUE}</g>
</svg>`;
}

const rendre = (source, taille, sortie) =>
  sharp(Buffer.from(source)).resize(taille, taille).png({ compressionLevel: 9 }).toFile(sortie);

mkdirSync("public/brand", { recursive: true });
mkdirSync("public/icons", { recursive: true });

const icone = svg(1.24);
const zoneSure = svg(0.92);

await rendre(icone, 1024, "public/brand/app-icon.png");
await rendre(icone, 512, "public/brand/app-icon-512.png");
await rendre(icone, 512, "public/icons/icon-512.png");
await rendre(icone, 192, "public/icons/icon-192.png");
await rendre(icone, 180, "public/icons/apple-touch-icon.png");
await rendre(zoneSure, 512, "public/icons/maskable-512.png");
writeFileSync("public/icons/icon.svg", icone);

console.log("logo et icônes générés");
