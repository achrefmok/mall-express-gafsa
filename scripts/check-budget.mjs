/**
 * Un plafond sur le poids de ce qu'on envoie aux téléphones.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi un budget, plutôt qu'une bonne intention
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le poids d'une application web ne grossit jamais d'un coup. Il grossit de
 * trois kilo-octets par semaine, chacun parfaitement justifié, et personne ne
 * remarque rien jusqu'au jour où l'accueil met huit secondes à s'afficher sur
 * un téléphone d'entrée de gamme en 3G — ce qui est exactement le public de
 * G-Mall à Gafsa.
 *
 * Un chiffre écrit dans un document ne change rien : c'est le refus automatique
 * qui protège.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qui est mesuré
 * ────────────────────────────────────────────────────────────────────────
 *
 * La **première charge** : tout le JavaScript qu'un visiteur arrivant
 * directement sur cette adresse doit télécharger avant que la page ne
 * fonctionne. C'est le seul chiffre qui décrive une expérience réelle — celle
 * de quelqu'un qui ouvre un lien reçu sur Facebook, sans rien en cache.
 *
 * Les tailles sont **compressées**, parce que c'est ce qui passe sur le réseau.
 * Un budget calé sur la taille brute punit ou absout au hasard, selon que le
 * code ajouté se compresse bien ou mal. Les valeurs obtenues ici collent à
 * celles qu'affiche `next build`, ce qui permet de les confronter.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Les plafonds ne sont pas des objectifs
 * ────────────────────────────────────────────────────────────────────────
 *
 * Ils sont calés une dizaine de pour cent au-dessus du poids d'aujourd'hui :
 * assez pour laisser respirer un ajout légitime, assez serrés pour qu'une
 * dérive se signale. Un dépassement n'est pas une faute — c'est une
 * conversation. Soit l'ajout vaut son poids et le plafond monte, dans un commit
 * qui le dit ; soit il ne le vaut pas, et on l'a appris avant la mise en
 * production plutôt qu'après.
 *
 * Lancement : `npm run check:budget` (après `next build`)
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const RACINE = ".next";

/*
  Le socle : les quatre paquets présents dans toutes les routes.

  React, le routeur, le nécessaire de Next. Chaque kilo-octet y est payé par
  chaque visite de chaque page — c'est le poste le plus rentable à surveiller,
  et le plus facile à laisser filer.
*/
const PLAFOND_SOCLE_KO = 115;

/** La première charge d'une page ordinaire. */
const PLAFOND_PAGE_KO = 200;

/*
  Les écrans qui portent une carte paient un supplément qui achète quelque
  chose : Leaflet et ses tuiles pour la carte des taxis, des deux côtés.
*/
const PLAFONDS_PARTICULIERS = {
  "/taxi": 225,
  "/taxi/chauffeur": 225,
};

const ko = (octets) => Math.round((octets / 1024) * 10) / 10;

if (!fs.existsSync(RACINE)) {
  console.error(`Aucune construction dans ${RACINE}/ — lancez « next build » d'abord.`);
  process.exit(1);
}

const manifeste = JSON.parse(
  fs.readFileSync(path.join(RACINE, "app-build-manifest.json"), "utf8"),
);

/*
  Les tailles sont mémorisées : les mêmes paquets reviennent dans des dizaines
  de routes, et les recompresser à chaque fois multiplierait la durée du
  contrôle par vingt.
*/
const cache = new Map();

const poidsReseau = (fichier) => {
  if (cache.has(fichier)) return cache.get(fichier);

  let taille = 0;
  try {
    taille = zlib.gzipSync(fs.readFileSync(path.join(RACINE, fichier))).length;
  } catch {
    taille = 0;
  }

  cache.set(fichier, taille);
  return taille;
};

/** « /(client)/accueil/page » et « /accueil » sont la même chose pour un visiteur. */
const nomLisible = (route) =>
  route.replace(/\/page$/, "").replace(/\/\([^)]+\)/g, "") || "/";

const routes = Object.entries(manifeste.pages).map(([nom, fichiers]) => [
  nomLisible(nom),
  [...new Set(fichiers.filter((f) => f.endsWith(".js")))],
]);

/*
  Le socle est ce que *toutes* les routes chargent, sans exception.

  Un seuil approché — « présent dans neuf routes sur dix » — paraissait plus
  souple et donnait des chiffres faux : les gros paquets partagés par la moitié
  de l'application tombaient alors du mauvais côté, et le poids de chaque page
  s'en trouvait faussé de soixante kilo-octets. La définition stricte est la
  seule qui produise un nombre confrontable à celui de `next build`.
*/
const occurrences = new Map();
for (const [, fichiers] of routes) {
  for (const f of fichiers) occurrences.set(f, (occurrences.get(f) ?? 0) + 1);
}

const socle = new Set(
  [...occurrences.entries()].filter(([, n]) => n === routes.length).map(([f]) => f),
);

const poidsSocle = [...socle].reduce((somme, f) => somme + poidsReseau(f), 0);

let ecarts = 0;
const lignes = routes
  .map(([nom, fichiers]) => {
    const poids = ko(fichiers.reduce((somme, f) => somme + poidsReseau(f), 0));
    const plafond = PLAFONDS_PARTICULIERS[nom] ?? PLAFOND_PAGE_KO;
    const depasse = poids > plafond;
    if (depasse) ecarts += 1;
    return { nom, poids, plafond, depasse };
  })
  .sort((a, b) => b.poids - a.poids);

const socleDepasse = ko(poidsSocle) > PLAFOND_SOCLE_KO;
if (socleDepasse) ecarts += 1;

console.log(`\nSocle — ${socle.size} paquets chargés par les ${routes.length} routes`);
console.log(`${socleDepasse ? "  KO " : "  ok "} ${ko(poidsSocle)} Ko / ${PLAFOND_SOCLE_KO} Ko`);

console.log("\nPremière charge — les huit pages les plus lourdes");
for (const l of lignes.slice(0, 8)) {
  console.log(
    `${l.depasse ? "  KO " : "  ok "} ${String(l.poids).padStart(6)} Ko / ${String(l.plafond).padStart(3)} Ko  ${l.nom}`,
  );
}

const autres = lignes.slice(8).filter((l) => l.depasse);
if (autres.length > 0) {
  console.log("\nAutres dépassements");
  for (const l of autres) {
    console.log(
      `  KO  ${String(l.poids).padStart(6)} Ko / ${String(l.plafond).padStart(3)} Ko  ${l.nom}`,
    );
  }
}

const mediane = [...lignes].sort((a, b) => a.poids - b.poids)[Math.floor(lignes.length / 2)];
console.log(`\nMédiane : ${mediane.poids} Ko`);

console.log(
  ecarts === 0
    ? "✓ tout tient dans son budget"
    : `✗ ${ecarts} dépassement(s) — soit l'ajout vaut son poids et le plafond monte dans ce commit, soit il ne le vaut pas`,
);

process.exit(ecarts === 0 ? 0 : 1);
