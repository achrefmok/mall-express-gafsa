/**
 * Les affiches de l'accueil, dessinées et rendues en WebP.
 *
 *   node scripts/generer-affiches.mjs
 *
 * Format 1200 × 600 : le rapport 2:1 du carrousel de l'accueil, celui que les
 * annonceurs livrent déjà. Tout est en formes et en texte — aucune photo, donc
 * aucun droit à demander, et un poids de quelques dizaines de kilo-octets.
 *
 * Deux règles de composition, pour que ces affiches restent lisibles à la
 * taille d'un téléphone :
 *
 *   · le texte vit dans la moitié gauche, jamais sur un motif chargé ;
 *   · une seule idée par affiche, un seul appel à l'action.
 *
 * Le titre reste court : au-delà de trente caractères, il faut réduire la
 * taille, et une affiche dont le titre est petit n'attire plus personne.
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const L = 1200;
const H = 600;
const POLICE = "Segoe UI, Noto Sans, Arial, sans-serif";

/** Le texte est échappé : un « & » brut casserait le document SVG. */
const txt = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function affiche({ fond, motif, accroche, accrocheFond, accrocheEncre, titre, titreAr, soustitre, cta, encre = "#ffffff" }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${fond}</linearGradient>
    <linearGradient id="voile" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000000" stop-opacity="0.34"/>
      <stop offset="0.62" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${L}" height="${H}" fill="url(#g)"/>
  ${motif}
  <rect width="${L}" height="${H}" fill="url(#voile)"/>

  <g transform="translate(72 0)">
    <g transform="translate(0 168)">
      <rect x="0" y="-34" rx="22" ry="22" width="${28 + accroche.length * 15}" height="44" fill="${accrocheFond}"/>
      <text x="${(28 + accroche.length * 15) / 2}" y="-3" text-anchor="middle" font-family="${POLICE}" font-size="20" font-weight="700" letter-spacing="3" fill="${accrocheEncre}">${txt(accroche)}</text>
    </g>

    <text x="0" y="272" font-family="${POLICE}" font-size="${titre.length > 26 ? 58 : 70}" font-weight="800" fill="${encre}">${txt(titre)}</text>
    ${titreAr ? `<text x="0" y="330" font-family="${POLICE}" font-size="34" font-weight="600" fill="${encre}" opacity="0.72">${txt(titreAr)}</text>` : ""}
    <text x="0" y="${titreAr ? 392 : 340}" font-family="${POLICE}" font-size="28" fill="${encre}" opacity="0.82">${txt(soustitre)}</text>

    <g transform="translate(0 ${titreAr ? 432 : 380})">
      <rect x="0" y="0" rx="28" ry="28" width="${56 + cta.length * 15}" height="56" fill="#ffffff"/>
      <text x="${(56 + cta.length * 15) / 2}" y="36" text-anchor="middle" font-family="${POLICE}" font-size="24" font-weight="700" fill="#241f2e">${txt(cta)}</text>
    </g>
  </g>
</svg>`;
}

/* Les motifs : des formes, jamais une image — elles occupent la moitié droite. */
const cercles = (couleur, opacite = 0.18) => `
  <circle cx="1010" cy="140" r="210" fill="${couleur}" opacity="${opacite}"/>
  <circle cx="1140" cy="470" r="150" fill="${couleur}" opacity="${opacite * 0.8}"/>
  <circle cx="880" cy="430" r="90" fill="${couleur}" opacity="${opacite * 0.6}"/>`;

const arcs = (couleur) => `
  <path d="M760 620 A 260 260 0 0 1 1280 620 Z" fill="${couleur}" opacity="0.16"/>
  <path d="M860 620 A 160 160 0 0 1 1180 620 Z" fill="${couleur}" opacity="0.22"/>
  <circle cx="1020" cy="170" r="66" fill="${couleur}" opacity="0.3"/>`;

const guirlande = (couleur) => `
  <path d="M700 90 Q 900 210 1140 70" stroke="${couleur}" stroke-width="5" fill="none" opacity="0.5"/>
  ${[740, 820, 900, 980, 1060, 1130].map((x, i) => `<circle cx="${x}" cy="${[128, 164, 178, 170, 140, 96][i]}" r="13" fill="${couleur}" opacity="0.85"/>`).join("")}
  <rect x="820" y="300" width="300" height="230" rx="26" fill="${couleur}" opacity="0.16"/>
  <rect x="870" y="360" width="200" height="170" rx="18" fill="${couleur}" opacity="0.2"/>`;

/** Une ambiance, sans un mot : pour une bannière de boutique. */
function visuel({ fond, motif }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${fond}</linearGradient></defs>
  <rect width="${L}" height="${H}" fill="url(#g)"/>
  ${motif}
</svg>`;
}

/** La même guirlande, étalée sur toute la largeur. */
const guirlandeLarge = (couleur) => `
  <path d="M60 110 Q 340 250 620 90 Q 900 250 1160 110" stroke="${couleur}" stroke-width="5" fill="none" opacity="0.5"/>
  ${[120, 220, 320, 420, 520, 620, 720, 820, 920, 1020, 1120].map((x, i) => `<circle cx="${x}" cy="${[150, 186, 196, 176, 136, 96, 136, 176, 196, 186, 150][i]}" r="13" fill="${couleur}" opacity="0.8"/>`).join("")}
  ${[150, 470, 790].map((x) => `<rect x="${x}" y="330" width="260" height="200" rx="26" fill="${couleur}" opacity="0.14"/><rect x="${x + 45}" y="385" width="170" height="145" rx="18" fill="${couleur}" opacity="0.18"/>`).join("")}
  <circle cx="600" cy="300" r="120" fill="${couleur}" opacity="0.1"/>`;

/**
 * La mer, en trois vagues et quelques poissons.
 *
 * Des formes, pas une photo : une photo de poisson achetée à une banque
 * d'images coûte, se retrouve chez le concurrent, et vieillit mal. Le dessin
 * dit « poissonnerie » en un coup d'œil et pèse vingt kilo-octets.
 */
const vagues = (couleur) => `
  ${[0, 1, 2].map((i) => `<path d="M0 ${300 + i * 90} Q 150 ${250 + i * 90} 300 ${300 + i * 90} T 600 ${300 + i * 90} T 900 ${300 + i * 90} T 1200 ${300 + i * 90}" stroke="${couleur}" stroke-width="6" fill="none" opacity="${0.4 - i * 0.1}"/>`).join("")}
  ${[[880, 230], [1010, 330], [790, 400]].map(([x, y], i) => {
    const e = [1, 0.78, 0.6][i];
    return `<g transform="translate(${x} ${y}) scale(${e})" opacity="${0.9 - i * 0.2}">
      <path d="M0 0 q 60 -46 130 0 q -70 46 -130 0 Z" fill="${couleur}"/>
      <path d="M130 0 l 40 -26 v 52 Z" fill="${couleur}"/>
      <circle cx="32" cy="-6" r="6" fill="#0b2f4a"/>
    </g>`;
  }).join("")}
  <circle cx="200" cy="170" r="130" fill="${couleur}" opacity="0.12"/>`;

/**
 * Le souk : des tentes, des lanternes, une allée.
 *
 * Pour Lelma3ardh. Un marché se reconnaît à ses toiles en zigzag bien avant
 * qu'on lise son nom — c'est ce que cette image emprunte, en trois formes.
 */
const souk = (couleur) => `
  ${[0, 1, 2, 3].map((i) => {
    const x = 120 + i * 260;
    return `<g opacity="${0.9 - i * 0.12}">
      <path d="M${x} 250 L${x + 110} 190 L${x + 220} 250 Z" fill="${couleur}" opacity="0.5"/>
      ${[0, 1, 2, 3].map((k) => `<path d="M${x + k * 55} 250 q 27 26 55 0" stroke="${couleur}" stroke-width="4" fill="none" opacity="0.8"/>`).join("")}
      <rect x="${x + 10}" y="250" width="200" height="230" rx="12" fill="${couleur}" opacity="0.13"/>
      <rect x="${x + 42}" y="320" width="136" height="160" rx="10" fill="${couleur}" opacity="0.2"/>
    </g>`;
  }).join("")}
  ${[220, 480, 740, 1000].map((x) => `<g opacity="0.85"><line x1="${x}" y1="60" x2="${x}" y2="110" stroke="${couleur}" stroke-width="3"/><path d="M${x - 22} 110 h44 l-10 46 h-24 Z" fill="${couleur}" opacity="0.6"/><circle cx="${x}" cy="168" r="7" fill="${couleur}"/></g>`).join("")}
  <rect x="0" y="520" width="1200" height="80" fill="${couleur}" opacity="0.08"/>`;

/** Un tapis tissé : bandes et losanges, le vocabulaire du mergoum. */
const tissage = (couleur) => `
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="0" y="${60 + i * 90}" width="1200" height="${i % 2 ? 26 : 12}" fill="${couleur}" opacity="${i % 2 ? 0.18 : 0.3}"/>`).join("")}
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${90 + i * 145} 300 l 52 -52 l 52 52 l -52 52 Z" fill="${couleur}" opacity="0.42"/>`).join("")}
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${90 + i * 145} 300 l 26 -26 l 26 26 l -26 26 Z" fill="#3d2608" opacity="0.3"/>`).join("")}`;

/** Le terroir : un palmier, des régimes de dattes, une colline. */
const palmeraie = (couleur) => `
  <path d="M0 600 q 300 -140 600 -40 q 300 100 600 -30 V600 Z" fill="${couleur}" opacity="0.14"/>
  ${[300, 620, 940].map((x, i) => {
    const e = [1, 0.82, 0.68][i];
    return `<g transform="translate(${x} 520) scale(${e})" opacity="${0.95 - i * 0.18}">
      <rect x="-9" y="-260" width="18" height="260" rx="9" fill="${couleur}" opacity="0.75"/>
      ${[-70, -35, 0, 35, 70].map((a) => `<path d="M0 -260 q ${a * 2} -70 ${a * 3} -10" stroke="${couleur}" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.8"/>`).join("")}
      ${[-28, 0, 28].map((d) => `<circle cx="${d}" cy="-236" r="13" fill="${couleur}"/>`).join("")}
    </g>`;
  }).join("")}`;

/** Le cuir : un sac, une ceinture, une couture en pointillé. */
const maroquinerie = (couleur) => `
  <g transform="translate(760 150)" opacity="0.9">
    <path d="M40 90 h300 a26 26 0 0 1 26 28 l 22 240 a30 30 0 0 1 -30 32 H22 a30 30 0 0 1 -30 -32 l 22 -240 A26 26 0 0 1 40 90 Z" fill="${couleur}" opacity="0.55"/>
    <path d="M120 90 V54 a70 70 0 0 1 140 0 V90" stroke="${couleur}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <path d="M20 160 H360" stroke="#3d2608" stroke-width="5" stroke-dasharray="14 12" opacity="0.45"/>
  </g>
  <g transform="translate(90 330)" opacity="0.8">
    <rect x="0" y="0" width="520" height="56" rx="14" fill="${couleur}" opacity="0.45"/>
    <rect x="430" y="-12" width="90" height="80" rx="16" fill="${couleur}" opacity="0.7"/>
    <path d="M20 28 H420" stroke="#3d2608" stroke-width="5" stroke-dasharray="12 14" opacity="0.4"/>
  </g>`;

const AFFICHES = {
  "affiche-black-friday": affiche({
    fond: `<stop offset="0" stop-color="#241f2e"/><stop offset="1" stop-color="#0d0b10"/>`,
    motif: cercles("#e0556f", 0.3),
    accroche: "24 HEURES",
    accrocheFond: "#e0556f",
    accrocheEncre: "#ffffff",
    titre: "BLACK FRIDAY",
    titreAr: "بلاك فرايدي في قفصة",
    soustitre: "Vendredi dès 00:01 — les boutiques du mall baissent leurs prix.",
    cta: "Voir les offres",
  }),

  "affiche-evenements": affiche({
    fond: `<stop offset="0" stop-color="#7b3f7f"/><stop offset="1" stop-color="#3a1f4d"/>`,
    motif: guirlande("#ffd9a8"),
    accroche: "FÊTE & ÉVÉNEMENTS",
    accrocheFond: "#ffffff",
    accrocheEncre: "#3a1f4d",
    titre: "Votre salle pour les grands jours",
    titreAr: "قاعات الأفراح والمناسبات",
    soustitre: "Mariages, fiançailles, anniversaires — les salles de Gafsa réunies.",
    cta: "Découvrir les salles",
  }),

  "affiche-sport": affiche({
    fond: `<stop offset="0" stop-color="#1c6a55"/><stop offset="1" stop-color="#123b46"/>`,
    motif: arcs("#8ff0c4"),
    accroche: "SPORT & LOISIRS",
    accrocheFond: "#8ff0c4",
    accrocheEncre: "#123b46",
    titre: "Bougez, jouez, respirez",
    titreAr: "رياضة وترفيه في قفصة",
    soustitre: "Salles de sport, terrains, clubs et espaces de jeux pour les enfants.",
    cta: "Trouver un club",
  }),

  "affiche-vendeurs": affiche({
    fond: `<stop offset="0" stop-color="#6d4b8f"/><stop offset="1" stop-color="#241f2e"/>`,
    motif: cercles("#ffffff", 0.14),
    accroche: "COMMERÇANTS",
    accrocheFond: "#ffffff",
    accrocheEncre: "#6d4b8f",
    titre: "Votre boutique en ligne en 3 minutes",
    titreAr: "افتح متجرك مجاناً",
    soustitre: "Zéro commission les trois premiers mois. Vos clients vous trouvent enfin.",
    cta: "Ouvrir ma boutique",
  }),

  /* La bannière de la salle d'exemple : une ambiance, sans un mot. Son nom et
     son adresse sont déjà écrits par la carte de l'annuaire ; gravés dans
     l'image, ils apparaîtraient deux fois — et le recadrage les couperait. */
  "exemple-salle": visuel({
    fond: `<stop offset="0" stop-color="#8a4f86"/><stop offset="1" stop-color="#2e1b3f"/>`,
    motif: guirlandeLarge("#ffe2b8"),
  }),

  /* La bannière d'un partenaire, même règle : sans un mot. La carte de
     l'accueil écrit déjà son nom et son accroche par-dessus. */
  "partenaire-dar-elhout": visuel({
    fond: `<stop offset="0" stop-color="#1f6f9e"/><stop offset="1" stop-color="#0b2f4a"/>`,
    motif: vagues("#a8e0f5"),
  }),

  /* Lelma3ardh et ses trois premiers stands. L'ambre les relie entre eux
     et les sépare du violet du mall : on n'y commande pas. */
  "lelma3ardh": visuel({
    fond: `<stop offset="0" stop-color="#b07a2a"/><stop offset="1" stop-color="#3d2608"/>`,
    motif: souk("#ffe0ad"),
  }),

  "expo-atelier-jasmin": visuel({
    fond: `<stop offset="0" stop-color="#9d4a3c"/><stop offset="1" stop-color="#3d1a14"/>`,
    motif: tissage("#ffd9b0"),
  }),

  "expo-terroir-gafsa": visuel({
    fond: `<stop offset="0" stop-color="#8a7320"/><stop offset="1" stop-color="#2f2a09"/>`,
    motif: palmeraie("#ffe9a8"),
  }),

  "expo-cuir-el-bahja": visuel({
    fond: `<stop offset="0" stop-color="#8a5a2b"/><stop offset="1" stop-color="#33200d"/>`,
    motif: maroquinerie("#f0c98f"),
  }),
};

mkdirSync("public/brand/affiches", { recursive: true });

for (const [nom, source] of Object.entries(AFFICHES)) {
  await sharp(Buffer.from(source)).webp({ quality: 88 }).toFile(`public/brand/affiches/${nom}.webp`);
  console.log("écrite :", `public/brand/affiches/${nom}.webp`);
}
