/**
 * Vérifie la logique des coloris — ce que la fiche produit montre pour chaque
 * couleur, et ce qu'elle avoue quand aucune image ne la montre.
 *
 * Le module `src/lib/variants.ts` décide seul de trois choses invisibles depuis
 * l'écran : quelles images afficher, dans quel ordre, et s'il faut prévenir le
 * client. Une erreur ici ne casse rien — elle montre simplement la mauvaise
 * couleur, et cela se découvre à la livraison.
 *
 * Ce contrôle a déjà trouvé un défaut réel : dès qu'un vendeur ajoutait une
 * photo pour un coloris, le coloris de référence — celui que montrent les
 * photos du produit — cessait de garder les siennes.
 *
 * Lancement : `npm run check:variants`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const src = fs.readFileSync("src/lib/variants.ts", "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Le TypeScript est transpilé à la volée : le dépôt n'embarque pas de lanceur
// de tests, et cette vérification ne justifie pas d'en ajouter un.
const out = path.join(os.tmpdir(), `variants-${process.pid}.mjs`);
fs.writeFileSync(out, js);
const { variantView, variantCarousel, displayableColors } = await import(pathToFileURL(out).href);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

const PHOTOS = ["p0.jpg", "p1.jpg"];
const photo = (url, ...autres) =>
  autres.length ? { url, generated: false, images: [url, ...autres] } : { url, generated: false };

console.log("\n[1] Une seule photo, quatre coloris déclarés");
{
  const colors = ["#b51a00", "#0055ff", "#00a1d8", "#000000"];
  const v = (c) => variantView(colors, PHOTOS, {}, c);

  check("le premier coloris est celui des photos", v("#b51a00").fidelity, "photo");
  check("les autres l avouent", colors.slice(1).map((c) => v(c).fidelity),
    ["unavailable", "unavailable", "unavailable"]);
  check("le coloris de reference garde les photos du produit", v("#b51a00").srcs, PHOTOS);
  check("les autres n affichent RIEN — jamais la photo du produit",
    colors.slice(1).map((c) => v(c).srcs.length), [0, 0, 0]);
  check("le carrousel les garde tous — ils restent en vente",
    variantCarousel(colors, PHOTOS, {}).map((x) => x.color), colors);
  check("les listes n en montrent qu un", displayableColors(colors, PHOTOS, {}), ["#b51a00"]);
}

console.log("\n[2] Une photo par coloris — Noir → Rouge → Bleu → Blanc → Noir");
{
  const colors = ["#000000", "#b51a00", "#0055ff", "#ffffff"];
  const vi = {
    "#b51a00": photo("rouge.jpg"),
    "#0055ff": photo("bleu.jpg"),
    "#ffffff": photo("blanc.jpg"),
  };
  const v = (c) => variantView(colors, PHOTOS, vi, c);

  check("chaque coloris a sa photo", colors.map((c) => v(c).fidelity),
    ["photo", "photo", "photo", "photo"]);
  check("et sa photo en tête", colors.map((c) => v(c).srcs[0]),
    ["p0.jpg", "rouge.jpg", "bleu.jpg", "blanc.jpg"]);
  check("la galerie d un coloris ne contient que ce coloris", v("#b51a00").srcs, ["rouge.jpg"]);
  check("le cycle revient au noir", v(colors[0]).srcs, PHOTOS);
  check("aucune image n est jamais répétée dans une même vue",
    colors.map((c) => v(c).srcs.length === new Set(v(c).srcs).size), [true, true, true, true]);
  check("les listes les montrent tous", displayableColors(colors, PHOTOS, vi), colors);
}

console.log("\n[3] Huit coloris, quatre photographiés");
{
  const colors = ["#b51a00","#e07800","#c4bc00","#3aa000","#00a1d8","#0055ff","#61187c","#d4006a"];
  const vi = {
    "#c4bc00": photo("jaune.jpg"),
    "#00a1d8": photo("cyan.jpg"),
    "#61187c": photo("violet.jpg"),
  };

  check("le carrousel garde les huit",
    variantCarousel(colors, PHOTOS, vi).length, 8);
  check("les listes n en gardent que quatre",
    displayableColors(colors, PHOTOS, vi), ["#b51a00", "#c4bc00", "#00a1d8", "#61187c"]);
  check("un coloris sans photo n affiche aucune image",
    variantView(colors, PHOTOS, vi, "#d4006a").srcs, []);
}

console.log("\n[4] Plusieurs vues pour un même coloris");
{
  const colors = ["#b51a00", "#0055ff"];
  const vi = { "#0055ff": photo("bleu-face.jpg", "bleu-dos.jpg") };
  const v = variantView(colors, PHOTOS, vi, "#0055ff");

  check("toutes les vues du coloris, dans l ordre", v.srcs, ["bleu-face.jpg", "bleu-dos.jpg"]);
  check("et jamais une vue d un autre coloris", v.srcs.some((u) => PHOTOS.includes(u)), false);
}

console.log("\n[5] Une vraie photo remplace une teinte fabriquée d autrefois");
{
  const colors = ["#b51a00", "#0055ff"];
  const avant = { "#0055ff": { url: "gen-bleu.webp", generated: true, from: "#b51a00" } };
  check("l ancienne teinte s affiche encore", variantView(colors, PHOTOS, avant, "#0055ff").fidelity, "generated");
  check("et le dit", variantView(colors, PHOTOS, avant, "#0055ff").srcs[0], "gen-bleu.webp");

  const apres = { "#0055ff": photo("vrai-bleu.jpg") };
  check("la vraie photo lève l étiquette", variantView(colors, PHOTOS, apres, "#0055ff").fidelity, "photo");
  check("le coloris des photos garde les siennes", variantView(colors, PHOTOS, apres, "#b51a00").srcs, PHOTOS);
  check("et reste une photo", variantView(colors, PHOTOS, apres, "#b51a00").fidelity, "photo");
}

console.log("\n[6] Cas limites");
{
  check("aucun coloris choisi", variantView(["#b51a00"], PHOTOS, {}, null).fidelity, "photo");
  check("aucune photo du tout", variantCarousel(["#b51a00", "#0055ff"], [], {}), []);
  check("colonne absente (null)", variantView(["#b51a00", "#0055ff"], PHOTOS, null, "#0055ff").fidelity, "unavailable");
  check("aucun coloris déclaré", variantView([], PHOTOS, {}, null).srcs, PHOTOS);
  check("un seul coloris", displayableColors(["#b51a00"], PHOTOS, {}), ["#b51a00"]);
  check("un coloris qui reprend une photo du produit ne montre que celle-la",
    variantView(["#b51a00", "#0055ff"], PHOTOS, { "#0055ff": photo("p1.jpg") }, "#0055ff").srcs,
    ["p1.jpg"]);
}

console.log("\n" + "[7] La chaine couleur → variante → image, cas par cas");
{
  const colors = ["#141414", "#b51a00", "#0055ff", "#e8c400"];
  const vi = {
    "#b51a00": { url: "gen-rouge.webp", generated: true, from: "p0.jpg" },
    "#0055ff": photo("vrai-bleu.jpg"),
  };
  const v = (c) => variantView(colors, PHOTOS, vi, c);

  // A — une couleur donne une variante, et une seule.
  check("A · chaque couleur donne sa variante",
    colors.map((c) => v(c).color), colors);

  // B — priorite : photo vendeur > image generee > rien.
  check("B · photo vendeur l emporte", [v("#0055ff").fidelity, v("#0055ff").srcs[0]],
    ["photo", "vrai-bleu.jpg"]);
  check("B · image generee sinon", [v("#b51a00").fidelity, v("#b51a00").srcs[0]],
    ["generated", "gen-rouge.webp"]);
  check("B · rien en dernier recours", [v("#e8c400").fidelity, v("#e8c400").srcs.length],
    ["unavailable", 0]);
  check("B · l image du produit ne sert jamais de repli",
    colors.slice(1).some((c) => v(c).srcs.some((u) => PHOTOS.includes(u))), false);

  // D — une vraie photo prend la place d une generee, sans toucher aux autres.
  const avant = colors.map((c) => v(c).srcs[0] ?? null);
  const apres = { ...vi, "#b51a00": photo("vrai-rouge.jpg") };
  const w = (c) => variantView(colors, PHOTOS, apres, c);

  check("D · le rouge passe de generee a photo vendeur",
    [w("#b51a00").fidelity, w("#b51a00").srcs[0]], ["photo", "vrai-rouge.jpg"]);
  check("D · les autres coloris n ont pas bouge",
    [0, 2, 3].map((i) => w(colors[i]).srcs[0] ?? null),
    [avant[0], avant[2], avant[3]]);
}

fs.rmSync(out, { force: true });
console.log(ko === 0 ? "\n✓ matrice complète : aucun écart" : `\n✗ ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
