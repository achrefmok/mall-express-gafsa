/**
 * Vérifie qu'une photo de vendeur n'est jamais dégradée sans raison.
 *
 * C'est la décision la plus lourde de conséquence du projet, et c'était la
 * moins couverte : `prepareImage` gouverne la netteté de toutes les photos du
 * site, ne tourne que dans un navigateur, et une régression n'y serait apparue
 * qu'une fois un produit publié — trop tard pour le fichier d'origine, qui
 * n'existe plus.
 *
 * Une version antérieure ramenait tout à 1600 pixels et réencodait
 * systématiquement, y compris une photo déjà propre. La règle actuelle préserve
 * l'original chaque fois qu'elle le peut. C'est cette règle-là qu'on fige ici :
 * la fonction ne dessine rien, elle décide, et une décision se vérifie.
 *
 * Lancement : `npm run check:upload`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const cache = path.join(os.tmpdir(), `upload-${process.pid}`);
fs.mkdirSync(cache, { recursive: true });

/*
  Le module est marqué « use client » et importe le client Supabase, dont on
  n'a que faire ici. On ne garde donc que ce qui précède le premier import de
  ce genre : les constantes et la fonction de décision, qui ne dépendent de
  rien.
*/
const source = fs.readFileSync("src/lib/upload.ts", "utf8");
const sansClient = source
  .replace('"use client";', "")
  .replace('import { createClient } from "@/lib/supabase/client";', "");

const js = ts.transpileModule(sansClient, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

/*
  Le reste du fichier téléverse réellement et référence `createClient`. On
  arrête la transpilation à la fonction de décision, seule chose qu'on éprouve.
*/
const coupe = js.indexOf("export async function prepareImage");
fs.writeFileSync(path.join(cache, "upload.mjs"), coupe === -1 ? js : js.slice(0, coupe));

const { planPreparation, LARGEUR_CONSEILLEE } = await import(
  pathToFileURL(path.join(cache, "upload.mjs")).href
);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

const Mo = 1024 * 1024;
const photo = (largeur, hauteur, taille, type = "image/jpeg") => ({ type, taille, largeur, hauteur });

/* ═══════════════════════════════════════════════════════════════════════
   Ne pas abîmer ce qui est déjà bon
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nPréservation de l'original");

check(
  "une photo de 1800 px reste intacte",
  planPreparation(photo(1800, 1200, 1.4 * Mo)).action,
  "intacte",
);

check(
  "une photo exactement à la limite reste intacte",
  planPreparation(photo(2560, 2560, 3 * Mo)).action,
  "intacte",
);

check(
  "une photo intacte garde ses dimensions",
  planPreparation(photo(1800, 1200, 1.4 * Mo)),
  { action: "intacte", largeur: 1800, hauteur: 1200, basseDefinition: false },
);

check(
  "un SVG n'est jamais touché",
  planPreparation(photo(64, 64, 2000, "image/svg+xml")),
  { action: "intacte", largeur: 64, hauteur: 64, basseDefinition: false },
);

check(
  "un SVG minuscule n'est pas dit de basse définition",
  planPreparation(photo(16, 16, 900, "image/svg+xml")).basseDefinition,
  false,
);

check(
  "un fichier qui n'est pas une image passe tel quel",
  planPreparation(photo(0, 0, 5000, "application/pdf")).action,
  "intacte",
);

/* ═══════════════════════════════════════════════════════════════════════
   Réduire ce qui le mérite
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nRéduction");

check(
  "un cliché de 24 mégapixels est ramené à la limite",
  planPreparation(photo(6000, 4000, 9 * Mo)),
  { action: "reduire", largeur: 2560, hauteur: 1707, basseDefinition: false },
);

check(
  "le rapport de forme est conservé",
  (() => {
    const p = planPreparation(photo(6000, 4000, 9 * Mo));
    return Math.abs(p.largeur / p.hauteur - 6000 / 4000) < 0.002;
  })(),
  true,
);

check(
  "une photo portrait est ramenée par sa hauteur",
  planPreparation(photo(3000, 5000, 8 * Mo)),
  { action: "reduire", largeur: 1536, hauteur: 2560, basseDefinition: false },
);

/*
  Le cas qui distingue le poids de la définition.

  Un PNG sans perte de mille pixels peut peser huit mégaoctets. Il faut le
  réencoder — c'est son poids qui pose problème — mais surtout pas le
  rétrécir : il est déjà petit, et le rapetisser lui ferait perdre la seule
  chose qu'il avait pour lui.
*/
check(
  "une image lourde mais petite est réencodée sans être rétrécie",
  planPreparation(photo(1000, 1000, 8 * Mo, "image/png")),
  { action: "reduire", largeur: 1000, hauteur: 1000, basseDefinition: false },
);

/* ═══════════════════════════════════════════════════════════════════════
   L'avertissement de basse définition
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nBasse définition");

check("le seuil conseillé est bien 900 px", LARGEUR_CONSEILLEE, 900);

check(
  "une capture de 640 px est signalée",
  planPreparation(photo(640, 480, 90_000)).basseDefinition,
  true,
);

check(
  "juste en dessous du seuil, c'est signalé",
  planPreparation(photo(899, 600, 120_000)).basseDefinition,
  true,
);

check(
  "au seuil exact, ce n'est plus signalé",
  planPreparation(photo(900, 600, 120_000)).basseDefinition,
  false,
);

check(
  "une image étroite mais haute n'est pas signalée",
  planPreparation(photo(400, 1400, 300_000)).basseDefinition,
  false,
);

/*
  L'avertissement n'est pas un refus.

  Le vendeur qui n'a que cette photo doit pouvoir la publier : une image de
  basse définition part quand même, et intacte — la réduire n'arrangerait rien.
*/
check(
  "une image de basse définition part quand même, et intacte",
  planPreparation(photo(400, 300, 40_000)).action,
  "intacte",
);

fs.rmSync(cache, { recursive: true, force: true });
console.log(
  ko === 0
    ? "\n✓ une photo déjà propre n'est jamais réencodée"
    : `\n✗ ${ko} écart(s)`,
);
process.exit(ko === 0 ? 0 : 1);
