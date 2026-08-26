import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vitest, pour les modules que les contrôles maison ne couvrent pas.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi deux dispositifs, et non un seul
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le projet vérifie déjà deux cent quarante assertions par des scripts Node,
 * un par domaine : géométrie d'affiche, présence des chauffeurs, préparation
 * des photos, stabilité des adresses. Ils sont lisibles, ils tournent en
 * intégration continue, et chacun raconte la panne qu'il empêche.
 *
 * Les migrer vers Vitest n'apporterait aucune assertion de plus. Ce serait un
 * remaniement pur, avec sa part de régressions, pour changer de lanceur.
 *
 * Vitest sert donc à ce que ces scripts ne couvrent pas : les petits modules
 * transverses, utilisés partout et vérifiés nulle part. `format.ts` met en
 * forme chaque prix et chaque date de l'application ; `space.ts` décide quelle
 * route existe dans quel déploiement — une erreur y rend des pages entières
 * inaccessibles, sans que rien ne le signale.
 *
 * Lancement : `npm test`
 */
export default defineConfig({
  resolve: {
    // Le même alias que TypeScript : les modules importent `@/lib/…`.
    /* `__dirname` n'existe pas dans un module ES : on le reconstruit depuis
       l'adresse du fichier. */
    alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /*
      Les tests vivent à côté du module qu'ils vérifient, pas dans un dossier
      parallèle. On les ouvre en même temps, on les modifie en même temps, et
      un module sans test se voit au premier coup d'œil dans la liste des
      fichiers.
    */
    reporters: ["default"],
  },
});
