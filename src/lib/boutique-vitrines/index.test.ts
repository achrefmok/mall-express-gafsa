import { describe, expect, it } from "vitest";
import { VITRINES, correspondOption, optionsPresentes, produitCorrespond, resolveVitrine } from "./index";

describe("resolveVitrine", () => {
  it("sous-catégorie précise : sa vitrine directement", () => {
    expect(resolveVitrine("mode-femme")?.id).toBe("mode");
    expect(resolveVitrine("electronique-telephones")?.id).toBe("telephones");
    expect(resolveVitrine("electronique-electromenager")?.id).toBe("electromenager");
    expect(resolveVitrine("beaute-parfums")?.id).toBe("parfumerie");
    expect(resolveVitrine("voitures-motos")?.id).toBe("moto");
  });

  it("métier sans maquette : pas de vitrine", () => {
    expect(resolveVitrine("bijouterie")).toBeNull();
    expect(resolveVitrine("maison")).toBeNull();
    expect(resolveVitrine("cafes")).toBeNull();
    expect(resolveVitrine("animaux-veterinaire")).toBeNull();
    expect(resolveVitrine("loisirs-terrains")).toBeNull();
    expect(resolveVitrine(null)).toBeNull();
  });

  it("électronique parente : la majorité des produits décide", () => {
    expect(resolveVitrine("electronique", [])?.id).toBe("telephones");
    expect(
      resolveVitrine("electronique", ["electronique-electromenager", "electronique-electromenager", "electronique-telephones"])?.id,
    ).toBe("electromenager");
    expect(resolveVitrine("electronique", ["electronique-electromenager", "electronique-telephones"])?.id).toBe("telephones");
  });

  it("beauté parente : parfumerie seulement si les parfums dominent", () => {
    expect(resolveVitrine("beaute", ["beaute-parfums", "beaute-parfums", "beaute-soin"])?.id).toBe("parfumerie");
    expect(resolveVitrine("beaute", ["beaute-soin", "beaute-maquillage"])).toBeNull();
    expect(resolveVitrine("beaute", [])).toBeNull();
  });
});

describe("correspondOption", () => {
  const marque = VITRINES.telephones.filtre.options.find((o) => o.cle === "iphone")!;
  const son = VITRINES.location.filtre.options.find((o) => o.cle === "son")!;
  const chat = VITRINES.animalerie.filtre.options.find((o) => o.cle === "chat")!;

  it("reconnaît un mot-clé en début de mot, sans casse ni accent", () => {
    expect(correspondOption(marque, "Apple iPhone 15")).toBe(true);
    expect(correspondOption(marque, "Samsung Galaxy")).toBe(false);
  });

  it("ne prend pas un mot-clé au milieu d'un autre mot", () => {
    expect(correspondOption(son, "Sono 2000 W")).toBe(true);
    expect(correspondOption(son, "Tente maison")).toBe(false);
  });

  it("arabe : article « ال » ignoré, slug de catégorie reconnu", () => {
    expect(correspondOption(chat, "طعام القطط")).toBe(true);
    expect(correspondOption(chat, "animaux-chats Croquettes")).toBe(true);
  });
});

describe("optionsPresentes / produitCorrespond", () => {
  const produits = [
    { name: "Galaxy S24", attributs: { marque: "Samsung" } },
    { name: "Chargeur 65W", attributs: { marque: "Samsung, Xiaomi" } },
    { name: "Coque transparente" },
  ];
  const filtre = VITRINES.telephones.filtre;

  it("n'affiche que les options portées par au moins un produit", () => {
    expect(optionsPresentes(produits, filtre).map((o) => o.cle)).toEqual(["samsung", "xiaomi"]);
  });

  it("aucun produit renseigné : filtre masqué (liste vide)", () => {
    expect(optionsPresentes([{ name: "Coque" }], filtre)).toEqual([]);
  });

  it("filtre une option, « الكل » laisse tout passer", () => {
    expect(produits.filter((p) => produitCorrespond(p, filtre, "xiaomi")).map((p) => p.name)).toEqual(["Chargeur 65W"]);
    expect(produits.filter((p) => produitCorrespond(p, filtre, null))).toHaveLength(3);
  });

  it("tailles : les tailles réelles, dans l'ordre usuel", () => {
    const tailles = optionsPresentes([{ name: "a", sizes: ["XL", "S"] }, { name: "b", sizes: ["M", "40"] }], VITRINES.mode.filtre);
    expect(tailles.map((o) => o.cle)).toEqual(["S", "M", "XL", "40"]);
  });
});
