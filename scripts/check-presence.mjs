/**
 * Vérifie qu'un chauffeur ne devient pas indisponible parce qu'il a fermé
 * l'application.
 *
 * C'est le défaut que ce module corrige, et c'est un défaut qu'aucun type ni
 * aucun rendu ne peut attraper : le code compilait parfaitement, l'écran
 * s'affichait sans erreur, et un chauffeur libre disparaissait au bout de dix
 * minutes. Seule une mesure le dit.
 *
 * Le contrôle central est le tout premier ci-dessous. Les autres protègent les
 * décisions qui l'entourent : le repli avant migration, le décompte des places,
 * et l'ordre dans lequel les chauffeurs sont proposés.
 *
 * Lancement : `npm run check:presence`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const cache = path.join(os.tmpdir(), `presence-${process.pid}`);
fs.mkdirSync(cache, { recursive: true });

/*
  Le module n'importe que des types — `TaxiStatus` vient du schéma. La
  transpilation les efface, il n'y a donc aucune dépendance à résoudre.
*/
const js = ts.transpileModule(fs.readFileSync("src/lib/taxi-presence.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
fs.writeFileSync(path.join(cache, "taxi-presence.mjs"), js);

const { presenceDe, precisionDe, apresReservation, rangPresence } = await import(
  pathToFileURL(path.join(cache, "taxi-presence.mjs")).href
);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

const MAINTENANT = Date.parse("2026-08-25T12:00:00Z");
const ilYA = (ms) => new Date(MAINTENANT - ms).toISOString();

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/* ═══════════════════════════════════════════════════════════════════════
   Le contrôle central : fermer l'application ne rend pas indisponible
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nApplication fermée");

{
  // Un chauffeur qui s'est déclaré libre puis a rangé son téléphone il y a
  // trois heures. L'ancien code le retirait au bout de dix minutes.
  const p = presenceDe(
    {
      status: "libre",
      is_available: true,
      lat: 34.425,
      lng: 8.784,
      position_updated_at: ilYA(3 * HEURE),
    },
    MAINTENANT,
  );

  check("il reste libre après trois heures sans relevé", p.statut, "libre");
  check("il reste joignable", p.joignable, true);
  check("mais on ne le place plus sur la carte", p.cartographiable, false);
  check("et l'écran le dit", p.precision, "inconnue");
}

{
  // Le cas inverse : il s'est déclaré occupé, et son GPS parle encore. La
  // fraîcheur de la position ne le rend pas disponible pour autant.
  const p = presenceDe(
    { status: "occupe", is_available: false, lat: 34.42, lng: 8.78, position_updated_at: ilYA(MINUTE) },
    MAINTENANT,
  );

  check("une position fraîche ne rend pas un occupé joignable", p.joignable, false);
  check("il reste visible sur la carte", p.cartographiable, true);
}

{
  // Un chauffeur qui a refusé le GPS. Il n'a jamais publié de position et doit
  // rester parfaitement appelable.
  const p = presenceDe(
    { status: "libre", is_available: true, lat: null, lng: null, position_updated_at: null },
    MAINTENANT,
  );

  check("sans GPS il reste joignable", p.joignable, true);
  check("sans GPS il n'est pas sur la carte", p.cartographiable, false);
  check("sa position est déclarée inconnue", p.positionConnue, false);
}

/* ═══════════════════════════════════════════════════════════════════════
   Le repli tant que la migration n'est pas collée
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nAvant migration");

check(
  "sans colonne status, is_available fait foi",
  presenceDe({ is_available: true, lat: 34.4, lng: 8.7, position_updated_at: ilYA(MINUTE) }, MAINTENANT)
    .statut,
  "libre",
);

check(
  "et un indisponible reste occupé",
  presenceDe({ is_available: false }, MAINTENANT).statut,
  "occupe",
);

check(
  "une valeur inconnue en base ne casse rien",
  presenceDe({ status: "n_importe_quoi", is_available: true }, MAINTENANT).statut,
  "libre",
);

/* ═══════════════════════════════════════════════════════════════════════
   Les paliers de fraîcheur
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nÂge de la position");

check("une minute : en direct", precisionDe(MINUTE), "directe");
check("dix minutes : récente", precisionDe(10 * MINUTE), "recente");
check("une heure : approximative", precisionDe(HEURE), "approximative");
check("six heures : inconnue", precisionDe(6 * HEURE), "inconnue");
check("aucune position : inconnue", precisionDe(null), "inconnue");

check(
  "une horloge en avance ne produit pas d'âge négatif",
  presenceDe(
    { status: "libre", lat: 34.4, lng: 8.7, position_updated_at: new Date(MAINTENANT + 5 * MINUTE).toISOString() },
    MAINTENANT,
  ).age,
  0,
);

/* ═══════════════════════════════════════════════════════════════════════
   Les places
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nPlaces");

check(
  "trois places moins une en laisse deux",
  apresReservation({ statut: "places", places: 3 }, 1),
  { places: 2, statut: "places" },
);

check(
  "la dernière place ferme le véhicule",
  apresReservation({ statut: "places", places: 1 }, 1),
  { places: 0, statut: "occupe" },
);

check(
  "une réservation plus grande que le reste ne descend pas sous zéro",
  apresReservation({ statut: "places", places: 2 }, 5),
  { places: 0, statut: "occupe" },
);

/*
  Places inconnues : aucun chiffre n'est inventé, mais il n'est plus libre.

  L'assertion attendait auparavant l'état inchangé — `{ statut: "libre" }` —
  et c'était le bug : `seats_free` étant nullable sans défaut, ne rien
  renseigner est le cas ordinaire. Un chauffeur qui acceptait une course
  restait donc éligible au matching et pouvait en accepter d'autres.

  Ce qu'on ne sait pas reste `null` ; ce qu'on sait — il vient de prendre
  quelqu'un — s'écrit.
*/
check(
  "des places non renseignées n'inventent aucun chiffre",
  apresReservation({ statut: "libre", places: null }, 2).places,
  null,
);

check(
  "mais accepter une course rend le chauffeur occupé",
  apresReservation({ statut: "libre", places: null }, 2),
  { places: null, statut: "occupe" },
);

check(
  "un statut occupé avec des places restantes n'est pas contredit",
  presenceDe({ status: "occupe", seats_free: 3 }, MAINTENANT).joignable,
  false,
);

check(
  "des places non renseignées valent null, pas zéro",
  presenceDe({ status: "libre", seats_free: null }, MAINTENANT).places,
  null,
);

/* ═══════════════════════════════════════════════════════════════════════
   L'ordre de présentation
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nClassement");

const libreEtSitue = presenceDe(
  { status: "libre", lat: 34.4, lng: 8.7, position_updated_at: ilYA(MINUTE) },
  MAINTENANT,
);
const libreSansPosition = presenceDe({ status: "libre" }, MAINTENANT);
const occupeEtSitue = presenceDe(
  { status: "occupe", lat: 34.4, lng: 8.7, position_updated_at: ilYA(MINUTE) },
  MAINTENANT,
);

check(
  "un libre bien situé passe devant un libre sans position",
  rangPresence(libreEtSitue) < rangPresence(libreSansPosition),
  true,
);

check(
  "un libre sans position passe devant un occupé parfaitement situé",
  rangPresence(libreSansPosition) < rangPresence(occupeEtSitue),
  true,
);

fs.rmSync(cache, { recursive: true, force: true });
console.log(
  ko === 0
    ? "\n✓ une application fermée ne rend personne indisponible"
    : `\n✗ ${ko} écart(s)`,
);
process.exit(ko === 0 ? 0 : 1);
