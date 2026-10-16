import { describe, expect, it } from "vitest";
import { accueilDe } from "./ancre-retour";

describe("accueilDe", () => {
  it("G-Mall : l'accueil client sous une page intérieure", () => {
    expect(accueilDe("gmall", "/commandes")).toBe("/accueil");
    expect(accueilDe("gmall", "/boutique/capsa-phone")).toBe("/accueil");
  });

  it("chaque espace a son propre accueil", () => {
    expect(accueilDe("gmall", "/vendeur/commandes")).toBe("/vendeur");
    expect(accueilDe("gmall", "/admin/taxi")).toBe("/admin");
    expect(accueilDe("gmall", "/lelma3ardh/gestion/stands")).toBe("/lelma3ardh/gestion");
  });

  it("application de transport : son accueil est la racine", () => {
    expect(accueilDe("transport", "/courses")).toBe("/");
  });

  it("rien sous un écran d'entrée", () => {
    expect(accueilDe("gmall", "/connexion")).toBeNull();
    expect(accueilDe("gmall", "/preparation")).toBeNull();
    expect(accueilDe("transport", "/inscription")).toBeNull();
  });
});
