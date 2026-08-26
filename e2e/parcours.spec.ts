import { expect, test } from "@playwright/test";

/**
 * L'application s'affiche-t-elle réellement ?
 *
 * C'est la seule question que ces contrôles posent, et c'est celle qu'aucun
 * autre dispositif du projet ne pose. Les deux cent quarante assertions
 * vérifient des fonctions ; la construction prouve que le code compile. Trois
 * des défauts trouvés ces derniers jours compilaient parfaitement et ne se
 * voyaient qu'à l'écran.
 *
 * Ils restent peu nombreux à dessein. Un parcours de bout en bout est lent et
 * fragile : lui confier ce qu'une fonction pure vérifierait mieux, c'est
 * échanger une seconde de calcul contre trente secondes d'attente et un test
 * qui rougit un jour sur dix sans raison.
 */

test.describe("Les pages publiques se rendent", () => {
  test("l'accueil affiche du contenu, pas une page d'erreur", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Mall Express/i);

    /*
      On cherche du contenu, pas l'absence d'erreur.

      Vérifier qu'aucune page d'erreur ne s'affiche laisse passer le cas le plus
      courant : une page qui se rend, vide, parce qu'une requête a échoué en
      silence. Un élément attendu est une preuve ; une absence n'en est pas une.
    */
    await expect(page.locator("body")).toContainText(/Gafsa/i);
  });

  test("le marketplace liste des produits", async ({ page }) => {
    await page.goto("/marketplace");
    // Un seul sélecteur : « main, body » en désigne deux, et Playwright refuse
    // une attente ambiguë plutôt que d'en choisir un au hasard.
    await expect(page.locator("body")).toBeVisible();

    /*
      Au moins un lien de fiche produit : c'est ce que la page existe pour
      montrer, et une liste vide est indiscernable d'une requête cassée.

      On compte les liens plutôt que d'en attendre un « visible ». La carte
      produit rend deux mises en page — une pour le téléphone, une pour le
      grand écran — dont l'une est masquée par CSS : exiger la visibilité du
      premier du document, c'est tomber une fois sur deux sur celle qui ne
      s'affiche pas.
    */
    await expect
      .poll(async () => page.locator('a[href^="/produit/"]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test("la carte des taxis se charge", async ({ page }) => {
    await page.goto("/taxi");

    /*
      La carte est chargée dynamiquement — Leaflet touche `window` et ne peut
      pas être rendu côté serveur. C'est exactement le genre d'import qui
      échoue en production sans échouer à la construction.
    */
    await expect(page.locator("body")).toContainText(/Chauffeurs|السائقون/i, {
      timeout: 15_000,
    });
  });
});

test.describe("Les adresses de fiches produit", () => {
  /*
    Les fiches ont deux formes d'adresse : l'ancienne en identifiant nu, qui
    circule depuis des mois dans des conversations et l'index de Google, et la
    nouvelle en toutes lettres. Les deux doivent mener au même produit — c'est
    la promesse qu'un lien partagé ne meurt pas.
  */
  test("un lien lisible mène bien au produit", async ({ page }) => {
    await page.goto("/marketplace");

    const premier = page.locator('a[href^="/produit/"]').first();
    await expect(premier).toBeVisible({ timeout: 15_000 });

    const href = await premier.getAttribute("href");
    expect(href).toBeTruthy();

    await page.goto(href!);
    await expect(page).not.toHaveTitle(/introuvable/i);

    // La canonique doit désigner la forme lisible, pas celle qu'on a demandée :
    // sans cela un moteur voit deux pages identiques et partage leur crédit.
    const canonique = page.locator('link[rel="canonical"]');
    await expect(canonique).toHaveAttribute("href", /\/produit\/.+/);
  });

  test("une adresse inventée répond « introuvable », pas une erreur", async ({ page }) => {
    const reponse = await page.goto("/produit/ceci-nexiste-pas");

    // Un 404 franc, et non un 500 : la différence compte pour un moteur de
    // recherche, qui réessaie l'un et retire l'autre de son index.
    expect(reponse?.status()).toBe(404);
  });
});

test("le plan du site est servi et contient des fiches", async ({ request }) => {
  const reponse = await request.get("/sitemap.xml");
  expect(reponse.ok()).toBeTruthy();

  const xml = await reponse.text();
  expect(xml).toContain("<urlset");
  expect(xml).toContain("/produit/");
});

test("la politique de sécurité interdit l'évaluation dynamique", async ({ request }) => {
  /*
    `unsafe-eval` a été retiré de la production ; le laisser revenir offrirait à
    un script injecté un outil qu'il n'aurait pas autrement. Rien dans le code
    ne le rappellerait — la valeur vit dans un fichier de configuration que
    personne ne relit.
  */
  const reponse = await request.get("/");
  const csp = reponse.headers()["content-security-policy"] ?? "";

  expect(csp).toContain("script-src");
  expect(csp).not.toContain("unsafe-eval");
});
