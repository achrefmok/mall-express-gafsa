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
};

mkdirSync("public/brand/affiches", { recursive: true });

for (const [nom, source] of Object.entries(AFFICHES)) {
  await sharp(Buffer.from(source)).webp({ quality: 88 }).toFile(`public/brand/affiches/${nom}.webp`);
  console.log("écrite :", `public/brand/affiches/${nom}.webp`);
}
