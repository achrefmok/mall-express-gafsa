/**
 * Vérifie que la compatibilité chauffeur/trajet est calculée, jamais inventée.
 *
 * L'écran taxi affiche « 92 % compatible · passe sur votre trajet ». Un tel
 * chiffre décide du chauffeur qu'on appelle : s'il sort d'un générateur, le
 * client se fait envoyer promener une fois et n'accorde plus jamais de crédit au
 * classement. Aucun rendu ni aucun type ne le dirait — seule une mesure le peut.
 *
 * On place donc des chauffeurs à des endroits connus, autour d'un trajet connu,
 * et l'on vérifie que le classement correspond à la géographie.
 *
 * Lancement : `npm run check:taxi`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

/*
  `taxi-match` importe `geo` : on transpile les deux, dans le même dossier, pour
  que l'import relatif se résolve.
*/
const cache = path.join(os.tmpdir(), `taxi-${process.pid}`);
fs.mkdirSync(cache, { recursive: true });

for (const module of ["geo", "taxi-match"]) {
  const js = ts.transpileModule(fs.readFileSync(`src/lib/${module}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(cache, `${module}.mjs`), js.replace('from "./geo"', 'from "./geo.mjs"'));
}

const { compatibilite, distanceAuTrajet, dureeMinutes, formatDistance, LIEUX_GAFSA } = await import(
  pathToFileURL(path.join(cache, "taxi-match.mjs")).href
);
const { positionPlausible } = await import(pathToFileURL(path.join(cache, "geo.mjs")).href);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

/* Un trajet réel : le centre de Gafsa vers l'aéroport. */
const CENTRE = { lat: 34.4265, lng: 8.7845 };
const AEROPORT = LIEUX_GAFSA.find((l) => l.id === "aeroport");
const trajet = { depart: CENTRE, destination: { lat: AEROPORT.lat, lng: AEROPORT.lng } };

console.log("\n[1] Distance au trajet, et non aux extrémités");
{
  // Un point à mi-chemin, pile sur l'axe : loin des deux bouts, sur le trajet.
  const milieu = {
    lat: (CENTRE.lat + AEROPORT.lat) / 2,
    lng: (CENTRE.lng + AEROPORT.lng) / 2,
  };
  const auTrajet = distanceAuTrajet(milieu, trajet.depart, trajet.destination);
  check("un point au milieu est sur le trajet", auTrajet < 30, true);

  // Le même point décalé vers le nord : il s'écarte de l'axe.
  const decale = { lat: milieu.lat + 0.02, lng: milieu.lng };
  const ecart = distanceAuTrajet(decale, trajet.depart, trajet.destination);
  check("un point décalé s en écarte", ecart > 1500 && ecart < 3000, true);

  // Un point au-delà de l'arrivée : la projection est bornée au segment, donc
  // la distance se mesure à l'arrivée elle-même.
  const auDela = { lat: AEROPORT.lat, lng: AEROPORT.lng + 0.05 };
  const borne = distanceAuTrajet(auDela, trajet.depart, trajet.destination);
  check("la projection est bornée au segment", borne > 3000, true);
}

console.log("\n[2] Chauffeur libre : c est la distance qui décide");
{
  const colle = compatibilite({ lat: 34.4267, lng: 8.7847 }, trajet, true);
  const proche = compatibilite({ lat: 34.4365, lng: 8.7845 }, trajet, true);
  const loin = compatibilite({ lat: 34.49, lng: 8.72 }, trajet, true);

  check("juste à côté : note pleine", colle.score, 100);
  check("plus loin : note plus basse", proche.score < colle.score, true);
  check("très loin : note nulle", loin.score, 0);
  check("la raison est toujours la même", colle.raison, "vient-vous-chercher");
  check("le classement suit la géographie", [colle, proche, loin].map((c) => c.score).every((v, i, a) => i === 0 || a[i - 1] >= v), true);
  check("et il annonce dans combien de minutes", colle.minutesJusquAVous >= 1, true);
}

console.log("\n[3] Chauffeur en course : c est le trajet qui décide");
{
  const surLaRoute = {
    lat: (CENTRE.lat + AEROPORT.lat) / 2,
    lng: (CENTRE.lng + AEROPORT.lng) / 2,
  };
  const ailleurs = { lat: 34.46, lng: 8.74 };

  const a = compatibilite(surLaRoute, trajet, false);
  const b = compatibilite(ailleurs, trajet, false);

  check("sur l axe : passe sur votre trajet", a.raison, "passe-sur-votre-trajet");
  check("et la note est haute", a.score, 100);
  check("à l écart : itinéraire différent", b.raison, "itineraire-different");
  check("et la note est basse", b.score < 40, true);
}

console.log("\n[4] Ce qu on refuse d affirmer");
{
  check("pas de position : rien", compatibilite(null, trajet, true), null);
  check("pas de trajet : rien", compatibilite(CENTRE, null, true), null);
  check(
    "en course sans destination saisie : rien",
    compatibilite({ lat: 34.44, lng: 8.79 }, { depart: CENTRE, destination: null }, false),
    null,
  );
  check(
    "libre sans destination : une note quand même, c est la distance",
    compatibilite({ lat: 34.4267, lng: 8.7847 }, { depart: CENTRE, destination: null }, true).score,
    100,
  );
}

console.log("\n[5] Ce qui s affiche");
{
  check("sous le kilomètre, en mètres", formatDistance(640), "650 m");
  check("au-delà, en kilomètres", formatDistance(1240), "1,2 km");
  check("jamais moins d une minute", dureeMinutes(10), 1);
  check("huit kilomètres font une vingtaine de minutes", dureeMinutes(8200), 20);
}

console.log("\n" + "[6] Le filtrage des relevés GPS");
{
  const base = { lat: 34.4265, lng: 8.7845, at: 1_000_000 };

  check("le premier relevé est toujours accepté", positionPlausible(null, { ...base, precision: 12 }), true);
  check(
    "un relevé imprécis est écarté",
    positionPlausible(base, { ...base, at: base.at + 5000, precision: 900 }),
    false,
  );
  check(
    "marcher cinquante mètres en dix secondes passe",
    positionPlausible(base, { lat: 34.4270, lng: 8.7845, at: base.at + 10_000, precision: 15 }),
    true,
  );
  check(
    "sauter trois kilomètres en deux secondes est refusé",
    positionPlausible(base, { lat: 34.4530, lng: 8.7845, at: base.at + 2000, precision: 15 }),
    false,
  );
  check(
    "le meme saut sur dix minutes redevient credible",
    positionPlausible(base, { lat: 34.4530, lng: 8.7845, at: base.at + 600_000, precision: 15 }),
    true,
  );
}

console.log("\n" + "[7] Le calcul d itineraire, en conditions reelles");
{
  const cheminModule = ts.transpileModule(fs.readFileSync("src/lib/routing.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(cache, "routing.mjs"), cheminModule.replace('from "./taxi-match"', 'from "./taxi-match.mjs"'));
  const { itineraire } = await import(pathToFileURL(path.join(cache, "routing.mjs")).href);

  const r = await itineraire(CENTRE, { lat: AEROPORT.lat, lng: AEROPORT.lng });
  const droite = Math.round(distanceAuTrajet(CENTRE, CENTRE, CENTRE) + 0);

  if (!r.routier) {
    console.log("  -- service de routage injoignable, controle reporte --");
  } else {
    check("le trace suit la route, pas la ligne droite", r.points.length > 20, true);
    check("la distance routiere depasse le vol d oiseau", r.metres > 4000, true);
    check("la duree est plausible", r.minutes >= 5 && r.minutes <= 25, true);
    check("le premier point est le depart", Math.abs(r.points[0].lat - CENTRE.lat) < 0.01, true);
    check(
      "le dernier point est l arrivee",
      Math.abs(r.points[r.points.length - 1].lat - AEROPORT.lat) < 0.01,
      true,
    );
  }
  void droite;
}

fs.rmSync(cache, { recursive: true, force: true });
console.log(ko === 0 ? "\n✓ la compatibilité suit la géographie" : `\n✗ ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
