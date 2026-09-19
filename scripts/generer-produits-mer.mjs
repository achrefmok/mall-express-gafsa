/**
 * Les visuels des produits de Dar Elhout, dessinés et rendus en WebP.
 *
 *   node scripts/generer-produits-mer.mjs
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi des dessins, et ce qu'ils ne remplacent pas
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une photo de dorade achetée à une banque d'images n'est pas la dorade de
 * Dar Elhout : elle se retrouve chez le concurrent, elle vieillit mal, et
 * elle promet un poisson qui n'est pas celui de l'étal. Ces dessins ne
 * prétendent rien : ils disent « dorade », « crevettes », « calamars » d'un
 * coup d'œil, pèsent une dizaine de kilo-octets, et ne coûtent aucun droit.
 *
 * Ils tiennent la place jusqu'à ce que le commerçant photographie son étal —
 * ce qu'il fait en deux touchers depuis son espace vendeur, et ce qui vaudra
 * toujours mieux que n'importe quel dessin.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Une grammaire commune
 * ────────────────────────────────────────────────────────────────────────
 *
 * Même carré, même fond de glace, même lumière en haut à gauche : posés côte
 * à côte dans une grille, six visuels qui ne partagent rien font un patchwork.
 * Ce qui change d'une carte à l'autre, c'est le sujet — et lui seul.
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const C = 800;

/** Le fond : de la glace pilée sous une lumière froide. */
const FOND = `
  <defs>
    <linearGradient id="glace" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eaf3f8"/>
      <stop offset="1" stop-color="#bcd4e3"/>
    </linearGradient>
    <radialGradient id="lumiere" cx="0.28" cy="0.2" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${C}" height="${C}" fill="url(#glace)"/>
  ${[...Array(26)].map((_, i) => {
    const x = (i * 137) % C;
    const y = (i * 241) % C;
    const r = 14 + ((i * 37) % 26);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.28"/>`;
  }).join("")}
  <rect width="${C}" height="${C}" fill="url(#lumiere)"/>`;

const carre = (sujet) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}">${FOND}${sujet}</svg>`;

/**
 * Un poisson, de profil.
 *
 * Corps en amande, queue en triangle, une nageoire dorsale, un œil. Cinq
 * formes : au-delà, on dessine une espèce précise, et on se trompe.
 */
function poisson({ x, y, longueur, dos, ventre, nageoire, echelle = 1, incline = 0 }) {
  const L = longueur;
  const h = L * 0.42;

  return `<g transform="translate(${x} ${y}) rotate(${incline}) scale(${echelle})">
    <path d="M${-L / 2} 0 Q ${-L / 4} ${-h} 0 ${-h * 0.82} Q ${L / 3} ${-h * 0.6} ${L / 2} 0
             Q ${L / 3} ${h * 0.6} 0 ${h * 0.82} Q ${-L / 4} ${h} ${-L / 2} 0 Z"
          fill="${dos}"/>
    <path d="M${-L / 2} 0 Q ${-L / 4} ${h} 0 ${h * 0.82} Q ${L / 3} ${h * 0.6} ${L / 2} 0 Z"
          fill="${ventre}" opacity="0.9"/>
    <path d="M${L / 2} 0 l ${L * 0.22} ${-h * 0.62} l 0 ${h * 1.24} Z" fill="${nageoire}"/>
    <path d="M${-L * 0.1} ${-h * 0.8} q ${L * 0.2} ${-h * 0.5} ${L * 0.34} ${h * 0.06} Z" fill="${nageoire}" opacity="0.85"/>
    <path d="M${-L * 0.06} ${h * 0.72} q ${L * 0.14} ${h * 0.4} ${L * 0.28} ${-h * 0.04} Z" fill="${nageoire}" opacity="0.7"/>
    <circle cx="${-L * 0.3}" cy="${-h * 0.18}" r="${L * 0.045}" fill="#20313d"/>
    <circle cx="${-L * 0.315}" cy="${-h * 0.24}" r="${L * 0.016}" fill="#ffffff"/>
    <path d="M${-L * 0.16} ${-h * 0.5} q ${L * 0.04} ${h * 0.5} 0 ${h}" stroke="${nageoire}" stroke-width="${L * 0.018}" fill="none" opacity="0.6"/>
  </g>`;
}

/**
 * Une crevette, sur sa vraie forme : une courbe en C.
 *
 * Premier essai : un corps en amande, des segments, des antennes. Cela ne
 * ressemblait à rien — une tache orange. Une crevette ne se reconnaît pas à
 * ses détails mais à sa **courbure** : le dos rond, la queue ramenée sous la
 * tête. Un arc épais, et tout le monde la nomme.
 */
function crevette({ x, y, taille, incline = 0 }) {
  const T = taille;
  const R = T * 0.34;
  const p = (a) => [R * Math.cos((a * Math.PI) / 180), R * Math.sin((a * Math.PI) / 180)];
  const n = (v) => v.toFixed(1);

  // Du haut-gauche au haut-droit, en passant par le dessous : la courbure.
  const [xt, yt] = p(130);
  const [xq, yq] = p(50);

  return `<g transform="translate(${x} ${y}) rotate(${incline})">
    <path d="M${n(xt)} ${n(yt)} A ${R} ${R} 0 1 0 ${n(xq)} ${n(yq)}"
          stroke="#f2825c" stroke-width="${T * 0.3}" stroke-linecap="round" fill="none"/>

    <!-- L arc va de 130° à 50° par le bas : les segments doivent y rester. -->
    ${[170, 205, 240, 275, 310, 345, 20].map((a) => {
      const [x1, y1] = p(a);
      const dedans = 1 - (T * 0.1) / R;
      return `<path d="M${n(x1 * (1 + (T * 0.1) / R))} ${n(y1 * (1 + (T * 0.1) / R))} L${n(x1 * dedans)} ${n(y1 * dedans)}"
                    stroke="#d75f3d" stroke-width="${T * 0.03}" stroke-linecap="round" opacity="0.65"/>`;
    }).join("")}

    <!-- 140 = 50 (l'angle du point de queue) + 90 : l'éventail part vers l'extérieur. -->
    <g transform="translate(${n(xq)} ${n(yq)}) rotate(140)">
      ${[-32, 0, 32].map((a) =>
        `<path d="M0 0 L${n(T * 0.26 * Math.cos((a - 90) * Math.PI / 180))} ${n(T * 0.26 * Math.sin((a - 90) * Math.PI / 180))}"
               stroke="#e06b45" stroke-width="${T * 0.07}" stroke-linecap="round"/>`).join("")}
    </g>

    <circle cx="${n(xt)}" cy="${n(yt)}" r="${T * 0.05}" fill="#20313d"/>
    <path d="M${n(xt)} ${n(yt)} q ${-T * 0.22} ${-T * 0.26} ${-T * 0.44} ${-T * 0.2}"
          stroke="#d75f3d" stroke-width="${T * 0.026}" stroke-linecap="round" fill="none"/>
    <path d="M${n(xt)} ${n(yt)} q ${-T * 0.3} ${-T * 0.1} ${-T * 0.46} ${T * 0.04}"
          stroke="#d75f3d" stroke-width="${T * 0.026}" stroke-linecap="round" fill="none"/>
  </g>`;
}

/** Un calamar : manteau en cône, deux nageoires, huit bras. */
function calamar({ x, y, taille }) {
  const T = taille;
  return `<g transform="translate(${x} ${y})">
    <path d="M0 ${-T} q ${T * 0.42} ${T * 0.5} ${T * 0.3} ${T * 0.92}
             q ${-T * 0.3} ${T * 0.18} ${-T * 0.6} 0
             q ${-T * 0.12} ${-T * 0.42} ${T * 0.3} ${-T * 0.92} Z" fill="#f0d3d8"/>
    <path d="M${-T * 0.3} ${-T * 0.42} q ${-T * 0.4} ${T * 0.1} ${-T * 0.1} ${T * 0.34} Z" fill="#e3b6bf"/>
    <path d="M${T * 0.3} ${-T * 0.42} q ${T * 0.4} ${T * 0.1} ${T * 0.1} ${T * 0.34} Z" fill="#e3b6bf"/>
    <circle cx="${-T * 0.16}" cy="${-T * 0.06}" r="${T * 0.07}" fill="#20313d"/>
    <circle cx="${T * 0.16}" cy="${-T * 0.06}" r="${T * 0.07}" fill="#20313d"/>
    ${[-0.42, -0.26, -0.1, 0.06, 0.22, 0.38].map((d, i) =>
      `<path d="M${d * T} ${T * 0.1} q ${(i % 2 ? 1 : -1) * T * 0.16} ${T * 0.34} ${(i % 2 ? 1 : -1) * T * 0.06} ${T * 0.66}"
             stroke="#e3b6bf" stroke-width="${T * 0.09}" stroke-linecap="round" fill="none"/>`).join("")}
  </g>`;
}

/** Un quartier de citron : la touche jaune qui dit « prêt à servir ». */
const citron = (x, y, r) => `<g transform="translate(${x} ${y})">
  <circle cx="0" cy="0" r="${r}" fill="#f7d354"/>
  <circle cx="0" cy="0" r="${r * 0.82}" fill="#fce88a"/>
  ${[...Array(6)].map((_, i) => `<path d="M0 0 L${r * 0.78 * Math.cos((i * 60 + 12) * Math.PI / 180)} ${r * 0.78 * Math.sin((i * 60 + 12) * Math.PI / 180)}" stroke="#f7d354" stroke-width="${r * 0.12}"/>`).join("")}
</g>`;

const PRODUITS = {
  "dorade-royale": carre(
    poisson({ x: 400, y: 410, longueur: 470, dos: "#8fb8cf", ventre: "#eef5f8", nageoire: "#e3c85e", incline: -6 }) +
      citron(628, 596, 58),
  ),

  "loup-de-mer": carre(
    poisson({ x: 400, y: 400, longueur: 500, dos: "#9aa8b4", ventre: "#f4f7f9", nageoire: "#c5d2dc", incline: 4 }) +
      citron(180, 600, 52),
  ),

  "crevettes-royales": carre(
    crevette({ x: 270, y: 280, taille: 220, incline: -18 }) +
      crevette({ x: 545, y: 430, taille: 236, incline: 12 }) +
      crevette({ x: 300, y: 605, taille: 210, incline: 34 }) +
      citron(640, 210, 54),
  ),

  "calamars-nettoyes": carre(
    calamar({ x: 400, y: 400, taille: 250 }) + citron(648, 580, 56),
  ),

  "plateau-grille": carre(
    `<ellipse cx="400" cy="440" rx="330" ry="250" fill="#ffffff" opacity="0.92"/>
     <ellipse cx="400" cy="440" rx="290" ry="214" fill="#f3efe6"/>` +
      poisson({ x: 360, y: 370, longueur: 330, dos: "#c28a52", ventre: "#e8c79a", nageoire: "#a8703c", incline: -8 }) +
      crevette({ x: 508, y: 486, taille: 132, incline: 16 }) +
      crevette({ x: 336, y: 512, taille: 126, incline: -8 }) +
      citron(600, 350, 48) +
      `<path d="M210 520 q 60 -26 130 -6" stroke="#5d8a43" stroke-width="16" stroke-linecap="round" fill="none"/>`,
  ),

  "sardines-fraiches": carre(
    [0, 1, 2, 3].map((i) =>
      poisson({
        x: 250 + (i % 2) * 300,
        y: 250 + Math.floor(i / 2) * 300,
        longueur: 300,
        dos: "#6f8fa6",
        ventre: "#f0f5f8",
        nageoire: "#9fb6c6",
        incline: i % 2 ? 10 : -10,
      }),
    ).join(""),
  ),
};

mkdirSync("public/brand/produits", { recursive: true });

for (const [nom, source] of Object.entries(PRODUITS)) {
  await sharp(Buffer.from(source)).webp({ quality: 88 }).toFile(`public/brand/produits/${nom}.webp`);
  console.log("écrit :", `public/brand/produits/${nom}.webp`);
}
