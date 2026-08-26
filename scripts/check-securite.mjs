/**
 * Vérifie qu'un contenu écrit par un vendeur ne peut pas s'échapper d'une
 * balise `<script>`.
 *
 * L'audit du 26 août 2026 a trouvé un XSS stocké sur les fiches produit et
 * boutique : les données Schema.org partaient dans `dangerouslySetInnerHTML`
 * par un `JSON.stringify` nu, qui échappe ce qui casserait le JSON et rien de
 * ce qui casserait le HTML. Un nom de produit refermait la balise et ouvrait
 * la sienne, et la politique de sécurité du contenu n'y opposait rien —
 * `script-src` porte `'unsafe-inline'`, obligatoire pour l'hydratation de Next.
 *
 * Deux contrôles, parce que corriger les deux appels ne suffit pas : le
 * troisième, écrit dans six mois, retomberait dans le même piège. On vérifie
 * donc l'échappement *et* qu'aucun `JSON.stringify` ne repasse jamais
 * directement dans une balise.
 *
 * Lancement : `npm run check:securite`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const cache = path.join(os.tmpdir(), `securite-${process.pid}`);
fs.mkdirSync(cache, { recursive: true });

for (const nom of ["json-ld", "phone"]) {
  const js = ts.transpileModule(fs.readFileSync(`src/lib/${nom}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(cache, `${nom}.mjs`), js);
}

const { jsonLd } = await import(pathToFileURL(path.join(cache, "json-ld.mjs")).href);
const { numeroValide, numeroNormalise, numeroLisible, numeroAppelable } = await import(
  pathToFileURL(path.join(cache, "phone.mjs")).href
);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

/* ═══════════════════════════════════════════════════════════════════════
   La charge qui fonctionnait
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nÉvasion de balise");

// Exactement le nom de produit qui refermait la balise avant le correctif.
const FERMETURE = "</" + "script><" + "script>alert(1)</" + "script>";

const rendu = jsonLd({ "@type": "Product", name: FERMETURE });

check("aucune fermeture de balise ne subsiste", rendu.includes("</" + "script"), false);
check("aucun chevron ouvrant ne subsiste", rendu.includes("<"), false);
check("aucun chevron fermant ne subsiste", rendu.includes(">"), false);

check(
  "une entité HTML ne peut pas reconstituer les chevrons",
  jsonLd({ n: "&lt;" + "script&gt;" }).includes("&"),
  false,
);

/* ═══════════════════════════════════════════════════════════════════════
   Ce qui doit malgré tout survivre
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nFidélité du contenu");

/*
  Neutraliser n'est pas censurer.

  Un vendeur a le droit d'appeler son article « Robe < 50 DT », et ce nom doit
  ressortir intact dans les résultats de recherche : les échappements Unicode
  restent du JSON valide, et l'analyseur les relit comme les caractères
  d'origine. Un filtrage, lui, aurait mutilé le nom.
*/
for (const original of [
  "Robe < 50 DT",
  "Ensemble 2 pièces > taille L",
  "Café & thé",
  'Guillemets "doubles" et \'simples\'',
  "قميص قطن",
  "Prix : 89,500 DT",
]) {
  const relu = JSON.parse(jsonLd({ name: original }));
  check(`« ${original} » revient intact`, relu.name, original);
}

check(
  "la structure entière est préservée",
  JSON.parse(jsonLd({ a: 1, b: [true, null], c: { d: "<x>" } })),
  { a: 1, b: [true, null], c: { d: "<x>" } },
);

/* ═══════════════════════════════════════════════════════════════════════
   Aucun appel nu ne doit revenir
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nAucune rechute dans le code");

/** Toutes les sources, parcourues une fois. */
function sources(dossier) {
  const trouvees = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) trouvees.push(...sources(complet));
    else if (/\.(tsx?|jsx?)$/.test(entree.name)) trouvees.push(complet);
  }
  return trouvees;
}

/*
  Les commentaires ne sont pas du code.

  Sans cette précaution, le contrôle se signalait lui-même : le module
  `json-ld.ts` décrit la faille dans son en-tête, et y cite forcément les deux
  termes qu'on recherche. On analyse donc le code débarrassé de ses
  commentaires — ce qui est de toute façon la seule lecture qui a du sens ici.
*/
function sansCommentaires(texte) {
  return texte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const fautifs = [];
for (const fichier of sources("src")) {
  const texte = sansCommentaires(fs.readFileSync(fichier, "utf8"));
  if (!texte.includes("dangerouslySetInnerHTML")) continue;

  /*
    On regarde la balise et ce qui la suit immédiatement.

    Le motif exact « dangerouslySetInnerHTML={{ __html: JSON.stringify( »
    peut être coupé par le formatage, d'où une fenêtre de deux cents
    caractères plutôt qu'une expression rigide.
  */
  let depuis = 0;
  for (;;) {
    const i = texte.indexOf("dangerouslySetInnerHTML", depuis);
    if (i === -1) break;
    const fenetre = texte.slice(i, i + 200);
    if (fenetre.includes("JSON.stringify")) {
      fautifs.push(`${fichier}:${texte.slice(0, i).split("\n").length}`);
    }
    depuis = i + 1;
  }
}

if (fautifs.length > 0) for (const f of fautifs) console.log("       ", f);
check("aucun JSON.stringify nu dans une balise", fautifs, []);

/* ═══════════════════════════════════════════════════════════════════════
   Les numéros de téléphone
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nNuméros de téléphone");

/*
  La règle était `phone.length < 6`, et rien d'autre.

  Elle acceptait « 123456 » et « abcdef » — aux endroits qui comptent le plus,
  puisque le numéro est le seul moyen de joindre un chauffeur ou un dépanneur.
  Un numéro faux ne se remarque pas à la saisie : il se remarque le soir où
  quelqu'un cherche un plombier.
*/
for (const [saisie, attendu] of [
  ["98123456", true],
  ["98 123 456", true],
  ["+216 98 123 456", true],
  ["0021698123456", true],
  ["21698123456", true],
  ["71.234.567", true],
  ["(98) 123-456", true],
]) {
  check(`« ${saisie} » est accepté`, numeroValide(saisie), attendu);
}

for (const saisie of [
  "123456",
  "abcdef",
  "981234",
  "981234567",
  "+33 6 12 34 56 78",
  "00000000",
  "",
  null,
]) {
  check(`« ${saisie} » est refusé`, numeroValide(saisie), false);
}

check("un numéro se réduit à ses huit chiffres", numeroNormalise("+216 98 123 456"), "98123456");
/*
  « 21621621621 » est un vrai numéro : 216 puis 21621621, un mobile valide.
  L'attente initiale de ce contrôle était fausse — le code avait raison.
  Le vrai piège est ailleurs : un indicatif suivi de huit chiffres qui n'en
  forment pas un numéro.
*/
check("l'indicatif retiré, le reste doit rester valide", numeroNormalise("21601234567"), null);
check("un numéro trop court n'est pas rattrapé", numeroNormalise("2162162"), null);
check("l'affichage groupe par deux puis trois", numeroLisible("98123456"), "98 123 456");
check("le lien d'appel porte l'indicatif", numeroAppelable("98 123 456"), "+21698123456");

/*
  Ce qui est déjà en base ressort tel quel.

  Des numéros saisis avant cette règle existent et ne sont pas tous conformes.
  Les effacer à l'affichage serait pire : un numéro douteux reste appelable, une
  chaîne vide ne l'est pas.
*/
check("un ancien numéro non conforme s'affiche quand même", numeroLisible("12345"), "12345");

fs.rmSync(cache, { recursive: true, force: true });
console.log(
  ko === 0
    ? "\n✓ un nom de produit ne peut pas s'échapper de sa balise"
    : `\n✗ ${ko} écart(s)`,
);
process.exit(ko === 0 ? 0 : 1);
