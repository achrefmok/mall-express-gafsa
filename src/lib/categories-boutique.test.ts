import { describe, expect, it } from "vitest";
import { categoriesPourBoutique, ordonnerParFamille, racineDe } from "./categories-boutique";

/* L'arbre réel du mall, en miniature. */
const c = (id: string, parent_id: string | null, sort_order: number) => ({ id, parent_id, sort_order });
const TOUTES = [
  c("mode", null, 1),
  c("mode-femme", "mode", 1),
  c("mode-homme", "mode", 2),
  c("electronique", null, 2),
  c("electronique-telephones", "electronique", 1),
  c("electronique-audio", "electronique", 2),
  c("animaux", null, 3),
  c("animaux-chats", "animaux", 2),
  c("animaux-chiens", "animaux", 1),
  c("animaux-toilettage", "animaux", 3),
];
const ids = (liste: Array<{ id: string }>) => liste.map((x) => x.id);

describe("racineDe", () => {
  it("un parent est sa propre racine", () => expect(racineDe("mode", TOUTES)).toBe("mode"));
  it("un enfant remonte à son parent", () => expect(racineDe("animaux-chats", TOUTES)).toBe("animaux"));
  it("une catégorie inconnue n'a pas de racine", () => expect(racineDe("x", TOUTES)).toBeNull());
});

describe("categoriesPourBoutique", () => {
  it("boutique d'électronique : sa famille seulement, jamais les animaux", () => {
    const { categories, filtre } = categoriesPourBoutique(TOUTES, ["electronique"]);
    expect(filtre).toBe(true);
    expect(ids(categories)).toEqual(["electronique", "electronique-telephones", "electronique-audio"]);
    expect(ids(categories)).not.toContain("animaux-chats");
    expect(ids(categories)).not.toContain("animaux-toilettage");
  });

  it("boutique animale : Chiens, Chats, Toilettage… dans l'ordre de l'administration", () => {
    const { categories } = categoriesPourBoutique(TOUTES, ["animaux"]);
    expect(ids(categories)).toEqual(["animaux", "animaux-chiens", "animaux-chats", "animaux-toilettage"]);
  });

  it("déclarer « Femme » ouvre toute la famille Mode", () => {
    const { categories } = categoriesPourBoutique(TOUTES, [null, "mode-femme"]);
    expect(ids(categories)).toEqual(["mode", "mode-femme", "mode-homme"]);
  });

  it("plusieurs types : plusieurs familles", () => {
    const { categories } = categoriesPourBoutique(TOUTES, ["mode", "electronique"]);
    expect(ids(categories)).toHaveLength(6);
  });

  it("aucun type déclaré : toutes les catégories, comme avant", () => {
    const { categories, filtre } = categoriesPourBoutique(TOUTES, [null, undefined]);
    expect(filtre).toBe(false);
    expect(categories).toHaveLength(TOUTES.length);
  });

  it("un produit déjà rangé hors famille garde sa catégorie", () => {
    const { categories } = categoriesPourBoutique(TOUTES, ["electronique"], "animaux-chats");
    expect(ids(categories)).toContain("animaux-chats");
  });
});

describe("ordonnerParFamille", () => {
  it("un enfant sans son parent dans la liste reste affiché", () => {
    expect(ids(ordonnerParFamille([c("animaux-chats", "animaux", 1)]))).toEqual(["animaux-chats"]);
  });
});
