import { defineConfig, devices } from "@playwright/test";

/**
 * Les contrôles de bout en bout.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'ils couvrent, et que rien d'autre ne couvre
 * ────────────────────────────────────────────────────────────────────────
 *
 * Deux cent quarante assertions vérifient des fonctions, et une construction
 * réussie prouve que le code compile. Ni l'une ni l'autre ne dit que
 * l'application **s'affiche**. Trois des défauts trouvés ces derniers jours
 * l'illustrent : un fournisseur d'animations absent qui n'animait rien sans
 * lever d'erreur, une photo qui débordait sous son texte, une teinte appliquée
 * au visage d'un mannequin. Tous compilaient parfaitement.
 *
 * Ces contrôles ouvrent un vrai navigateur sur la vraie application, et
 * regardent. Ils restent délibérément peu nombreux : un parcours de bout en
 * bout est lent, fragile, et coûte plus qu'il ne rapporte dès qu'on lui demande
 * de vérifier ce qu'une fonction pure vérifierait mieux.
 *
 * Ils ne couvrent donc que ce qui n'est vérifiable qu'ainsi : la page se rend,
 * la navigation aboutit, les adresses résolvent.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le navigateur n'est pas téléchargé
 * ────────────────────────────────────────────────────────────────────────
 *
 * En local, `channel: "chrome"` utilise le Chrome déjà installé plutôt que les
 * quelque cent cinquante mégaoctets que Playwright téléchargerait. En
 * intégration continue il n'y a pas de Chrome installé : on y laisse Playwright
 * utiliser son propre Chromium, que le workflow installe.
 *
 * Ce qu'on veut savoir — « la page se rend-elle » — ne dépend pas d'une version
 * précise du moteur.
 *
 * Lancement : `npm run e2e` (démarre le serveur tout seul)
 */
/* En intégration continue, le Chromium de Playwright ; en local, le Chrome de
   la machine. `undefined` laisse Playwright choisir le sien. */
const CANAL = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  /*
    Aucune reprise en local, deux en intégration continue.

    Une reprise masque un test instable, et un test instable qu'on ne voit pas
    finit par être ignoré même quand il a raison. En intégration continue on
    tolère l'aléa réseau, pas ailleurs.
  */
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3120",
    // La trace n'est gardée qu'après un échec, et seulement à la reprise :
    // c'est le moment où l'on a besoin de voir, et jamais avant.
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: CANAL },
    },
    {
      /*
        Un téléphone, parce que c'est l'appareil réel.

        Le public de Mall Express ouvre l'application sur un Android d'entrée de
        gamme. Une mise en page qui tient sur un écran de bureau et déborde sur
        trois cent quatre-vingts pixels est un défaut que seul ce format révèle.
      */
      name: "mobile",
      use: { ...devices["Pixel 5"], channel: CANAL },
    },
  ],

  webServer: {
    command: "npx next start -p 3120",
    url: "http://127.0.0.1:3120",
    timeout: 120_000,
    // Réutiliser un serveur déjà lancé fait gagner une minute à chaque essai en
    // local ; en intégration continue, il n'y en a jamais.
    reuseExistingServer: !process.env.CI,
  },
});
