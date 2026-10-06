import { describe, expect, it } from "vitest";
import { calculerCompletude, type DonneesCompletude } from "./vitrine-completude";

const VIDE: DonneesCompletude = {
  hasCover: false,
  hasLogo: false,
  hasHoraires: false,
  storiesActives: 0,
  offreActive: false,
  produitsTotal: 0,
  produitsAvecAttributCle: 0,
  packsPrets: 0,
  zonesLivraison: 0,
};

describe("calculerCompletude", () => {
  it("une boutique toute neuve est à 0 %, jamais une division par zéro", () => {
    const { pourcentage, etapes } = calculerCompletude("mode", VIDE);
    expect(pourcentage).toBe(0);
    expect(etapes.every((e) => !e.fait)).toBe(true);
  });

  it("les quatre étapes communes suffisent à un thème par défaut", () => {
    const complet: DonneesCompletude = {
      ...VIDE,
      hasCover: true,
      hasLogo: true,
      hasHoraires: true,
      storiesActives: 1,
      offreActive: true,
    };
    const { pourcentage, etapes } = calculerCompletude("default", complet);
    expect(etapes).toHaveLength(4);
    expect(pourcentage).toBe(100);
  });

  it("Mode ajoute une cinquième étape sur le type des produits", () => {
    const { etapes } = calculerCompletude("mode", VIDE);
    expect(etapes).toHaveLength(5);
    expect(etapes.at(-1)?.id).toBe("mode-type");
  });

  it("80% pile compte comme suffisant, 79% non", () => {
    const base = { ...VIDE, produitsTotal: 10 };
    const pile = calculerCompletude("mode", { ...base, produitsAvecAttributCle: 8 });
    const pasAssez = calculerCompletude("mode", { ...base, produitsAvecAttributCle: 7 });
    expect(pile.etapes.at(-1)?.fait).toBe(true);
    expect(pasAssez.etapes.at(-1)?.fait).toBe(false);
  });

  it("Parapharmacie exige à la fois le taux d'attribut ET un pack prêt", () => {
    const base = { ...VIDE, produitsTotal: 10, produitsAvecAttributCle: 10 };
    const sansPack = calculerCompletude("parapharmacie", { ...base, packsPrets: 0 });
    const avecPack = calculerCompletude("parapharmacie", { ...base, packsPrets: 1 });
    expect(sansPack.etapes.at(-1)?.fait).toBe(false);
    expect(avecPack.etapes.at(-1)?.fait).toBe(true);
  });

  it("Services ne regarde que les zones de livraison, pas les attributs produit", () => {
    const { etapes } = calculerCompletude("services", { ...VIDE, zonesLivraison: 2 });
    expect(etapes.at(-1)?.fait).toBe(true);
  });

  it("un thème sans règle propre (ex. sport) n'a que les quatre étapes communes", () => {
    const { etapes } = calculerCompletude("sport", VIDE);
    expect(etapes).toHaveLength(4);
  });
});
