/**
 * Vérifie qu'une affiche ne se chevauche pas, ne déborde pas, et n'annonce pas
 * de remise inventée.
 *
 * Une affiche se juge à l'œil, ce qui la rend piégeuse : deux cadres qui se
 * recouvrent de trois pixels, une photo qui sort de la zone sûre, une dernière
 * rangée décentrée — rien ne lève d'erreur, rien n'apparaît dans un rendu de
 * test, et le vendeur ne le découvre qu'après avoir publié devant ses clients.
 *
 * On calcule donc les rectangles pour toutes les combinaisons de format et de
 * nombre de produits, et on les confronte à trois règles simples : chacun tient
 * dans l'affiche, aucun n'en touche un autre, et aucun n'empiète sur les
 * bandeaux.
 *
 * Lancement : `npm run check:poster`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const cache = path.join(os.tmpdir(), `poster-${process.pid}`);
fs.mkdirSync(cache, { recursive: true });

const js = ts.transpileModule(fs.readFileSync("src/lib/poster.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
fs.writeFileSync(path.join(cache, "poster.mjs"), js);

const { FORMATS, THEMES, PRODUITS_MAX, disposition, prixAffiche, nomFichier } = await import(
  pathToFileURL(path.join(cache, "poster.mjs")).href
);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

/** Deux rectangles se touchent-ils ? Une tolérance d'un pixel absorbe les arrondis. */
const seChevauchent = (a, b) =>
  a.x + a.w > b.x + 1 && b.x + b.w > a.x + 1 && a.y + a.h > b.y + 1 && b.y + b.h > a.y + 1;

/* ═══════════════════════════════════════════════════════════════════════
   La géométrie, pour toutes les combinaisons possibles
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nGéométrie");

let debordements = 0;
let collisions = 0;
let surBandeau = 0;
let vides = 0;

for (const format of Object.values(FORMATS)) {
  for (let n = 1; n <= PRODUITS_MAX; n += 1) {
    const d = disposition(n, format);

    if (d.produits.length !== n) vides += 1;

    for (const c of d.produits) {
      // Tient dans l'affiche, et garde une taille utilisable.
      if (c.x < 0 || c.y < 0 || c.x + c.w > format.largeur || c.y + c.h > format.hauteur) {
        debordements += 1;
        console.log(`       débordement ${format.cle} n=${n}`, JSON.stringify(c));
      }
      if (c.w < 80 || c.h < 80) vides += 1;

      /*
        Ni chevauchement, ni frôlement.

        L'absence de chevauchement ne suffisait pas : les produits finissaient
        exactement là où commençait le pied, et la pastille du numéro venait
        affleurer la dernière photo. On exige donc un écart réel, proportionnel
        au format.
      */
      const ecartMin = Math.round(Math.min(format.largeur, format.hauteur) * 0.02);
      if (
        seChevauchent(c, d.entete) ||
        seChevauchent(c, d.pied) ||
        c.y < d.entete.y + d.entete.h + ecartMin ||
        c.y + c.h > d.pied.y - ecartMin
      ) {
        surBandeau += 1;
        console.log(`       colle à un bandeau ${format.cle} n=${n}`, JSON.stringify(c));
      }
    }

    for (let i = 0; i < d.produits.length; i += 1) {
      for (let j = i + 1; j < d.produits.length; j += 1) {
        if (seChevauchent(d.produits[i], d.produits[j])) {
          collisions += 1;
          console.log(`       collision ${format.cle} n=${n} entre ${i} et ${j}`);
        }
      }
    }
  }
}

check("aucun cadre ne déborde de l'affiche", debordements, 0);
check("aucun cadre n'en recouvre un autre", collisions, 0);
check("aucun cadre ne colle à un bandeau", surBandeau, 0);
check("chaque produit reçoit un cadre utilisable", vides, 0);

/* ═══════════════════════════════════════════════════════════════════════
   Les cas de mise en page qui ont une intention
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nMise en page");

{
  // Un produit seul doit occuper toute la largeur : c'est une affiche, pas une
  // vignette perdue au milieu.
  const d = disposition(1, FORMATS.story);
  check(
    "un produit seul prend toute la largeur utile",
    d.produits[0].w === FORMATS.story.largeur - d.produits[0].x * 2,
    true,
  );
}

{
  // Deux produits en story : l'un au-dessus de l'autre. En colonnes, chaque
  // photo tomberait à 450 px de haut sur un format qui en offre 1400.
  const d = disposition(2, FORMATS.story);
  check("deux produits en story se superposent", d.produits[0].y < d.produits[1].y, true);
  check("et partagent la même largeur", d.produits[0].w, d.produits[1].w);
}

{
  // Deux produits en carré : côte à côte.
  const d = disposition(2, FORMATS.carre);
  check("deux produits en carré se juxtaposent", d.produits[0].x < d.produits[1].x, true);
  check("à la même hauteur", d.produits[0].y, d.produits[1].y);
}

{
  // Trois produits : un phare pleine largeur, deux compagnons.
  const d = disposition(3, FORMATS.carre);
  check("le premier des trois est mis en avant", d.produits[0].w > d.produits[1].w, true);
  check("les deux autres se partagent la seconde rangée", d.produits[1].y, d.produits[2].y);
}

{
  // Cinq produits en grille de deux : le dernier est seul sur sa rangée et doit
  // être centré, sinon l'affiche paraît tronquée à droite.
  const d = disposition(5, FORMATS.carre);
  const dernier = d.produits[4];
  const centreDernier = dernier.x + dernier.w / 2;
  const centreAffiche = FORMATS.carre.largeur / 2;
  check("la rangée incomplète est centrée", Math.abs(centreDernier - centreAffiche) <= 2, true);
}

check(
  "au-delà de la limite, on retombe sur le maximum",
  disposition(12, FORMATS.carre).produits.length,
  PRODUITS_MAX,
);

check("zéro produit ne produit pas une affiche vide", disposition(0, FORMATS.carre).produits.length, 1);

/* ═══════════════════════════════════════════════════════════════════════
   Le prix : ce qu'on a le droit d'annoncer
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nPrix et remises");

check("une vraie remise est annoncée", prixAffiche(80, 100), { actuel: 80, barre: 100, remise: 20 });

check(
  "l'arrondi se fait vers le bas, jamais en faveur de l'annonce",
  prixAffiche(80.4, 100).remise,
  19,
);

check("sans prix de comparaison, aucune remise", prixAffiche(80, null), {
  actuel: 80,
  barre: null,
  remise: null,
});

check("un prix de comparaison plus bas n'invente pas de remise", prixAffiche(100, 80), {
  actuel: 100,
  barre: null,
  remise: null,
});

check("un prix de comparaison égal n'invente pas de remise", prixAffiche(100, 100).remise, null);

check("une remise sous un pour cent n'est pas affichée", prixAffiche(99.9, 100).remise, null);

/* ═══════════════════════════════════════════════════════════════════════
   Détails
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nDétails");

check(
  "le nom de fichier porte la boutique et la date",
  nomFichier("Boutique Ahmed", "story", new Date("2026-08-26T10:00:00Z")),
  "boutique-ahmed-story-2026-08-26.png",
);

check(
  "un nom entièrement arabe reste téléchargeable",
  nomFichier("متجر أحمد", "carre", new Date("2026-08-26T10:00:00Z")),
  "boutique-carre-2026-08-26.png",
);

check(
  "les accents ne se retrouvent pas dans le nom de fichier",
  nomFichier("Épicerie Créative", "paysage", new Date("2026-08-26T10:00:00Z")),
  "epicerie-creative-paysage-2026-08-26.png",
);

check(
  "chaque thème définit toutes ses couleurs",
  Object.values(THEMES).every((t) =>
    ["fond", "encre", "discret", "carte", "encreCarte", "accent", "surAccent"].every(
      (k) => t[k] !== undefined && t[k] !== null && String(t[k]).length > 0,
    ),
  ),
  true,
);

fs.rmSync(cache, { recursive: true, force: true });
console.log(ko === 0 ? "\n✓ l'affiche tient dans ses marges" : `\n✗ ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
