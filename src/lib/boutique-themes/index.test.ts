import { describe, expect, it } from "vitest";
import { resolveTheme } from "./index";

describe("resolveTheme", () => {
  it("catégorie principale : résout directement son thème", () => {
    expect(resolveTheme("alimentation").id).toBe("alimentation");
  });

  it("sous-catégorie : hérite du thème de sa famille parente", () => {
    expect(resolveTheme("mode-femme").id).toBe("mode");
  });

  it("category_id nul : retombe sur le thème par défaut", () => {
    expect(resolveTheme(null).id).toBe("default");
    expect(resolveTheme(undefined).id).toBe("default");
  });

  it("catégorie inconnue : retombe sur le thème par défaut", () => {
    expect(resolveTheme("une-categorie-qui-n-existe-pas").id).toBe("default");
  });

  it("sport et sport-loisirs : le même thème pour les deux", () => {
    expect(resolveTheme("sport").id).toBe(resolveTheme("sport-loisirs").id);
  });

  it("bijouterie et parapharmacie : résolvent vers leur propre thème, pas vers le défaut", () => {
    expect(resolveTheme("bijouterie").id).toBe("bijouterie");
    expect(resolveTheme("parapharmacie").id).toBe("parapharmacie");
  });
});
