/**
 * Vérifie qu'un lien partagé hier fonctionne encore demain.
 *
 * Les fiches produit ont deux adresses : celle d'avant, en identifiant nu, et
 * celle d'aujourd'hui, en toutes lettres. La première circule depuis des mois
 * dans des conversations WhatsApp, des favoris et l'index de Google — elle ne
 * doit jamais cesser de fonctionner, et rien dans le code ne le rappellerait.
 *
 * Une règle de lecture d'adresse est aussi le genre de chose qu'on resserre un
 * jour sans y penser, en corrigeant un cas particulier. Ces contrôles disent ce
 * qui a le droit de changer et ce qui n'en a pas.
 *
 * Lancement : `npm run check:url`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ts = (await import(pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href))
  .default;

const cache = path.join(os.tmpdir(), `url-${process.pid}`);
fs.mkdirSync(cache, { recursive: true });

const js = ts.transpileModule(fs.readFileSync("src/lib/product-url.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
fs.writeFileSync(path.join(cache, "product-url.mjs"), js);

const { lienProduit, lireSegment, intervalleDe } = await import(
  pathToFileURL(path.join(cache, "product-url.mjs")).href
);

let ko = 0;
const check = (nom, reel, attendu) => {
  const a = JSON.stringify(reel);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) ko++;
  console.log(`${ok ? "  ok " : "  KO "} ${nom}${ok ? "" : `\n       obtenu ${a}\n       attendu ${b}`}`);
};

const UUID = "232811f0-9128-4b68-873e-b04fccfcd2b4";

/* ═══════════════════════════════════════════════════════════════════════
   L'adresse produite
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nAdresses produites");

check(
  "le nom du produit précède l'identifiant court",
  lienProduit({ id: UUID, name: "Ecouteur bluetooth M19" }),
  "/produit/ecouteur-bluetooth-m19-232811f0",
);

check(
  "les accents disparaissent de l'adresse",
  lienProduit({ id: UUID, name: "Écouteurs à réduction de bruit" }),
  "/produit/ecouteurs-a-reduction-de-bruit-232811f0",
);

check(
  "la ponctuation devient un tiret unique",
  lienProduit({ id: UUID, name: "Sac  à   main — cuir, noir !" }),
  "/produit/sac-a-main-cuir-noir-232811f0",
);

/*
  Un nom entièrement arabe ne produit aucune lettre latine.

  Le repli sur l'identifiant complet vaut mieux qu'une adresse réduite à un
  tiret : elle serait laide, et surtout elle ne dirait rien de plus que
  l'identifiant qu'elle remplace.
*/
check(
  "un nom arabe retombe sur l'identifiant complet",
  lienProduit({ id: UUID, name: "قميص قطن" }),
  `/produit/${UUID}`,
);

check("un produit sans nom aussi", lienProduit({ id: UUID, name: null }), `/produit/${UUID}`);

check(
  "un nom très long est tronqué sans laisser de tiret pendant",
  lienProduit({
    id: UUID,
    name: "Ensemble deux pièces en lin brodé main coloris sable taille unique livraison",
  }).endsWith("-232811f0"),
  true,
);

check(
  "et reste sous une longueur raisonnable",
  lienProduit({ id: UUID, name: "a".repeat(200) }).length < 90,
  true,
);

/* ═══════════════════════════════════════════════════════════════════════
   Les adresses relues — c'est ici que les liens survivent ou meurent
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nAdresses relues");

check("l'ancien lien complet est reconnu tel quel", lireSegment(UUID), {
  complet: UUID,
  prefixe: null,
});

check("la nouvelle forme rend son préfixe", lireSegment("ecouteur-bluetooth-m19-232811f0"), {
  complet: null,
  prefixe: "232811f0",
});

check("le préfixe seul est accepté", lireSegment("232811f0"), {
  complet: null,
  prefixe: "232811f0",
});

check("les majuscules ne gênent pas", lireSegment("Ecouteur-M19-232811F0"), {
  complet: null,
  prefixe: "232811f0",
});

check("une adresse encodée est décodée", lireSegment("sac%2Da%2Dmain-232811f0"), {
  complet: null,
  prefixe: "232811f0",
});

for (const segment of ["nimportequoi", "produit", "sac-a-main", "", "----"]) {
  check(`« ${segment} » ne désigne rien`, lireSegment(segment), {
    complet: null,
    prefixe: null,
  });
}

/*
  Cinq caractères, c'est trop peu.

  Un préfixe court finirait par désigner deux produits, et une fiche qui
  s'ouvre au hasard est bien pire qu'une page introuvable : le client croit
  regarder ce qu'il a demandé.
*/
check("un préfixe trop court est refusé", lireSegment("sac-12345"), {
  complet: null,
  prefixe: null,
});

/* ═══════════════════════════════════════════════════════════════════════
   L'intervalle interrogé en base
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nIntervalle d'identifiants");

check("un préfixe décrit un intervalle bien formé", intervalleDe("232811f0"), {
  debut: "232811f0-0000-0000-0000-000000000000",
  fin: "232811f0-ffff-ffff-ffff-ffffffffffff",
});

check(
  "l'identifiant réel tombe bien dans son intervalle",
  (() => {
    const i = intervalleDe("232811f0");
    return i.debut <= UUID && UUID <= i.fin;
  })(),
  true,
);

check("un préfixe non hexadécimal est refusé", intervalleDe("zzzzzzzz"), null);
check("un préfixe trop long est refusé", intervalleDe("232811f0a"), null);
check("un préfixe trop court est refusé", intervalleDe("2328"), null);

/* ═══════════════════════════════════════════════════════════════════════
   L'aller-retour complet
   ═══════════════════════════════════════════════════════════════════════ */

console.log("\nAller-retour");

for (const nom of ["Ecouteur bluetooth M19", "Robe < 50 DT", "Café & thé", "Sac"]) {
  const segment = lienProduit({ id: UUID, name: nom }).replace("/produit/", "");
  const relu = lireSegment(segment);
  const retrouve = relu.complet === UUID || relu.prefixe === UUID.slice(0, 8);
  check(`« ${nom} » se retrouve après aller-retour`, retrouve, true);
}

fs.rmSync(cache, { recursive: true, force: true });
console.log(
  ko === 0 ? "\n✓ un lien partagé hier fonctionne encore" : `\n✗ ${ko} écart(s)`,
);
process.exit(ko === 0 ? 0 : 1);
