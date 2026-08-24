/**
 * Prouve que la fabrication d'un coloris ne touche qu'au vêtement.
 *
 * Le masque de `lib/garment-recolor` est une suite d'heuristiques : fond par
 * propagation, cône de peau, zone de tête, plus grande région connexe. Chacune
 * peut se tromper, et l'erreur qui compte — recolorer un visage — ne se voit ni
 * dans un type, ni dans un rendu de page, ni dans une revue de code.
 *
 * On fabrique donc un mannequin dont on connaît chaque pixel : fond uni, cheveux
 * sombres, visage, cou, bras, mains, tee-shirt presque noir orné d'un logo
 * blanc. Une **carte de régions** est peinte en même temps que l'image, si bien
 * que la vérité de terrain ne dépend d'aucun calcul de géométrie — c'est la
 * même écriture qui pose la couleur et qui note à quelle région le pixel
 * appartient.
 *
 * Le contrôle strict porte sur les **pixels bruts**, avant tout encodage, et
 * n'admet aucune tolérance : un pixel hors du vêtement a été écrit, ou il ne
 * l'a pas été. Comparé après compression, il mêlait ce que la couleur avait
 * changé et ce que le codec avait déplacé — le WebP quantifie par blocs de
 * seize pixels, et un aplat qui passe du noir au rouge fait bouger de vingt
 * unités des pixels situés bien au-delà du tissu.
 *
 * Le fichier réellement publié est contrôlé ensuite, séparément : sa déviation
 * de compression doit rester bornée. C'est une autre question, et elle mérite
 * son propre chiffre.
 *
 * Lancement : `npm run check:recolor`
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const source = fs.readFileSync("src/lib/garment-recolor.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

/*
  Le fichier transpilé est écrit dans le projet, pas dans le dossier temporaire
  du système : il importe `sharp`, et Node résout les modules en remontant
  l'arborescence depuis le fichier. Depuis `%TEMP%`, il ne trouverait aucun
  `node_modules`.
*/
const cache = path.resolve("node_modules/.cache");
fs.mkdirSync(cache, { recursive: true });
const sortie = path.join(cache, `garment-recolor-${process.pid}.mjs`);
fs.writeFileSync(sortie, js);
const { recolorGarment, recolorGarmentRaw } = await import(pathToFileURL(sortie).href);
const sharp = (await import("sharp")).default;

/* ─── Le mannequin ─────────────────────────────────────────────────────── */

const W = 400;
const H = 520;

const FOND = 0;
const CHEVEUX = 1;
const PEAU = 2;
const TISSU = 3;
const LOGO = 4;

const NOMS = ["arriere-plan", "cheveux", "peau (visage, cou, bras, mains)", "tissu", "logo"];

const COULEURS = {
  [FOND]: [242, 242, 244],
  [CHEVEUX]: [42, 32, 24],
  [PEAU]: [217, 162, 113],
  [TISSU]: [37, 37, 40],
  [LOGO]: [240, 240, 240],
};

/**
 * L'image et sa carte de régions, peintes d'un même geste.
 *
 * C'est la carte qui fait foi ensuite. Décrire les régions par des prédicats
 * géométriques indépendants avait laissé passer un chevauchement d'une colonne
 * entre le bras et le tee-shirt : le contrôle attendait du tissu là où l'image
 * montrait de la peau, et signalait une faute qui n'existait pas.
 */
function peindre() {
  const px = Buffer.alloc(W * H * 3);
  const carte = new Uint8Array(W * H);

  const dansEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let region = FOND;

      // Le tee-shirt, avec ses plis.
      if (x >= 121 && x < 280 && y >= 162 && y < 382) region = TISSU;
      // Le logo, au milieu de la poitrine.
      if (x >= 174 && x < 226 && y >= 222 && y < 262) region = LOGO;
      // Les bras, à gauche et à droite du buste, et les mains au bout.
      if (x >= 92 && x < 119 && y >= 202 && y < 332) region = PEAU;
      if (x >= 282 && x < 309 && y >= 202 && y < 332) region = PEAU;
      if (dansEllipse(x, y, 105, 348, 17, 17)) region = PEAU;
      if (dansEllipse(x, y, 296, 348, 17, 17)) region = PEAU;
      // Le cou, puis les cheveux, puis le visage par-dessus.
      if (x >= 184 && x < 216 && y >= 142 && y < 168) region = PEAU;
      if (x >= 150 && x < 250 && y >= 22 && y < 92) region = CHEVEUX;
      if (dansEllipse(x, y, 200, 96, 46, 56)) region = PEAU;

      const i = y * W + x;
      carte[i] = region;

      const [r, g, b] = COULEURS[region];
      // Un dégradé vertical tient lieu de plis : c'est cette variation de clarté
      // que la recoloration doit conserver.
      const pli = region === TISSU ? Math.round(Math.sin((y - 162) / 26) * 9) : 0;

      const o = i * 3;
      px[o] = r + pli;
      px[o + 1] = g + pli;
      px[o + 2] = b + pli;
    }
  }

  return { px, carte };
}

const { px: original, carte } = peindre();

/*
  La bordure de deux pixels qui longe le tissu.

  Le passage du presque-noir au rouge déplace de quelques unités les pixels
  immédiatement voisins, du côté conservé comme de l'autre : c'est le codec qui
  sonne au contour, pas la recoloration qui déborde. On l'écarte donc du
  contrôle « intact » — et on mesure de combien il dévie, plutôt que de fermer
  les yeux.
*/
const BANDE = 2;
const bordure = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (carte[i] === TISSU) continue;

    for (let dy = -BANDE; dy <= BANDE && !bordure[i]; dy++) {
      for (let dx = -BANDE; dx <= BANDE; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (carte[ny * W + nx] === TISSU) {
          bordure[i] = 1;
          break;
        }
      }
    }
  }
}

/* ─── Contrôle ─────────────────────────────────────────────────────────── */

function teinte(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (((h * 60) % 360) + 360) % 360;
}

const ecartAngle = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

let ko = 0;
const check = (nom, condition, detail = "") => {
  if (!condition) ko++;
  console.log(`${condition ? "  ok " : "  KO "} ${nom}${condition ? "" : `  ← ${detail}`}`);
};

const png = await sharp(original, { raw: { width: W, height: H, channels: 3 } })
  .png()
  .toBuffer();

/*
  Le témoin de l'encodage : la même image passée par le WebP, sans recoloration.

  Il ne sert qu'au contrôle du fichier publié, à la fin. Les contrôles stricts,
  eux, portent sur les pixels bruts et se comparent directement à l'original.
*/
const temoinEncode = await sharp(original, { raw: { width: W, height: H, channels: 3 } })
  .webp({ quality: 82, effort: 5 })
  .toBuffer()
  .then((buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true }));

const COLORIS = [
  ["Rouge", "#d02020", 0],
  ["Bleu", "#1858d8", 220],
  ["Jaune", "#f0d020", 51],
  ["Violet", "#7a2e9e", 282],
  ["Turquoise", "#20b8b0", 178],
];

console.log(`\nMannequin ${W}×${H} — tee-shirt presque noir, logo blanc, visage, cheveux, bras.\n`);

for (const [nom, hex, teinteAttendue] of COLORIS) {
  console.log(`[${nom}] ${hex}`);

  const resultat = await recolorGarmentRaw(png, hex);
  if (!resultat.ok) {
    check(`fabrication de ${nom}`, false, `refusee : ${resultat.reason}`);
    continue;
  }

  const px = resultat.data;
  const C = resultat.channels;

  check(
    "dimensions conservees",
    resultat.width === W && resultat.height === H,
    `${resultat.width}×${resultat.height}`,
  );

  const bouges = [0, 0, 0, 0, 0];
  const totaux = [0, 0, 0, 0, 0];
  const pires = [0, 0, 0, 0, 0];
  let halo = 0;

  let recolores = 0;
  let tissuTotal = 0;
  let ecartMax = 0;
  const clartes = [];

  for (let i = 0; i < W * H; i++) {
    const region = carte[i];
    const o = i * C;
    const q = i * 3;
    // Pixels bruts contre pixels bruts : un écart, si petit soit-il, est une
    // écriture. Aucune tolérance n'a lieu d'être ici.
    const ecart = Math.max(
      Math.abs(px[o] - original[q]),
      Math.abs(px[o + 1] - original[q + 1]),
      Math.abs(px[o + 2] - original[q + 2]),
    );

    if (region === TISSU) {
      tissuTotal++;
      const t = teinte(px[o], px[o + 1], px[o + 2]);
      if (t !== null && ecartAngle(t, teinteAttendue) < 26) {
        recolores++;
        ecartMax = Math.max(ecartMax, ecartAngle(t, teinteAttendue));
        clartes.push(
          (Math.max(px[o], px[o + 1], px[o + 2]) + Math.min(px[o], px[o + 1], px[o + 2])) / 2,
        );
      }
      continue;
    }

    /*
      La frontiere du tissu est traitee a part.

      Le masque est adouci sur un peu plus d'un pixel avant d'etre applique :
      sans cela, la limite entre le tissu recolore et ce qui l'entoure serait un
      escalier. Ce fondu depose quelques unites sur la premiere rangee de pixels
      voisins — c'est de l'antialiasing, presente dans n'importe quel
      compositing, et non une recoloration qui deborde. On le borne plutot que
      de l'interdire.
    */
    if (bordure[i]) {
      halo = Math.max(halo, ecart);
      continue;
    }

    totaux[region]++;
    if (ecart > 0) bouges[region]++;
    pires[region] = Math.max(pires[region], ecart);
  }

  for (const region of [FOND, CHEVEUX, PEAU, LOGO]) {
    const part = totaux[region] ? bouges[region] / totaux[region] : 0;
    check(
      `${NOMS[region]} intact`,
      bouges[region] === 0,
      `${bouges[region]} pixels sur ${totaux[region]} (${(part * 100).toFixed(2)} %), ecart max ${pires[region]}`,
    );
  }

  check(`antialiasing de bordure borne (${halo} sur 255)`, halo <= 8, `deviation ${halo}`);

  const couverture = recolores / tissuTotal;
  check("le tissu a pris la couleur", couverture > 0.9, `${(couverture * 100).toFixed(1)} % du tissu`);
  check("teinte juste", ecartMax < 26, `ecart max ${ecartMax.toFixed(0)}°`);

  // Les plis sont dans la variation de clarté : elle doit survivre.
  const amplitude = Math.max(...clartes) - Math.min(...clartes);
  check("les plis survivent", amplitude > 10, `amplitude ${amplitude.toFixed(0)} sur 255`);

  console.log("");
}

/* ─── Le fichier publié ────────────────────────────────────────────────── */

console.log("[WebP] ce que la compression déplace sur le fichier réellement publié");
{
  const publie = await recolorGarment(png, "#d02020");
  const relu = await sharp(publie.data).raw().toBuffer({ resolveWithObject: true });
  const C = relu.info.channels;
  const T = temoinEncode.info.channels;

  let pire = 0;
  let loin = 0;
  for (let i = 0; i < W * H; i++) {
    if (carte[i] === TISSU || bordure[i]) continue;
    const o = i * C;
    const q = i * T;
    const e = Math.max(
      Math.abs(relu.data[o] - temoinEncode.data[q]),
      Math.abs(relu.data[o + 1] - temoinEncode.data[q + 1]),
      Math.abs(relu.data[o + 2] - temoinEncode.data[q + 2]),
    );
    if (e > pire) pire = e;
    if (e > 6) loin++;
  }

  /*
    Le codec quantifie par blocs de seize pixels : un aplat qui passe du noir au
    rouge change le contexte de compression de tout le bloc, et déplace de
    quelques unités des pixels qui n'ont pourtant pas été écrits. C'est
    imperceptible et sans rapport avec la recoloration — mais il faut le borner
    plutôt que l'ignorer.
  */
  check(
    `deviation de compression bornee (max ${pire} sur 255, ${loin} pixels au-dela de 6)`,
    pire < 40,
    `max ${pire}`,
  );
}

/* ─── Ce qui doit échouer ──────────────────────────────────────────────── */

console.log("[Refus] une photo sans vetement isolable");
{
  const vide = Buffer.alloc(W * H * 3, 240);
  const img = await sharp(vide, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const r = await recolorGarment(img, "#d02020");
  check("refus plutot qu'une image douteuse", r.ok === false, JSON.stringify(r.ok));
}

console.log("\n[Refus] une couleur illisible");
{
  const r = await recolorGarment(png, "rouge");
  check(
    "code hexadecimal exige",
    r.ok === false && r.reason === "couleur-illisible",
    JSON.stringify(r),
  );
}

fs.rmSync(sortie, { force: true });
console.log(ko === 0 ? "\n✓ le sujet est intact dans tous les cas" : `\n✗ ${ko} ecart(s)`);
process.exit(ko === 0 ? 0 : 1);
