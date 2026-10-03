import { describe, expect, it } from "vitest";
import {
  cx,
  formatPrice,
  fullName,
  monogram,
  percentOff,
  ressembleAUneAdresseEmail,
  shortName,
} from "./format";

/**
 * Ce module met en forme chaque prix, chaque nom et chaque initiale de
 * l'application, et n'avait aucun contrôle.
 *
 * Ses défauts ne se voient pas en le lisant : ils apparaissent sur un écran,
 * une fois, dans un cas qu'on n'avait pas en tête — un prix à trois décimales,
 * un vendeur sans nom de famille, une remise d'un demi pour cent.
 */

describe("formatPrice", () => {
  it("n'affiche pas de décimales quand il n'y en a pas", () => {
    expect(formatPrice(89)).toBe("89 DT");
  });

  it("affiche les millimes quand ils existent", () => {
    // Le dinar se subdivise en millimes : trois décimales, jamais deux.
    expect(formatPrice(89.5)).toBe("89,500 DT");
    expect(formatPrice(0.125)).toBe("0,125 DT");
  });

  it("accepte une chaîne, parce que PostgREST rend les décimaux ainsi", () => {
    expect(formatPrice("42")).toBe("42 DT");
  });

  it("dit « — » plutôt que « NaN DT »", () => {
    expect(formatPrice("abc")).toBe("—");
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("traite l'absence de prix comme zéro, pas comme une erreur", () => {
    expect(formatPrice(null)).toBe("0 DT");
    expect(formatPrice(undefined)).toBe("0 DT");
  });

  it("change de devise avec la langue", () => {
    expect(formatPrice(89, "ar")).toContain("د.ت");
  });
});

describe("percentOff", () => {
  it("calcule une remise réelle", () => {
    expect(percentOff(80, 100)).toBe(20);
  });

  it("n'invente rien sans prix de comparaison", () => {
    expect(percentOff(80, null)).toBeNull();
    expect(percentOff(80, undefined)).toBeNull();
  });

  it("refuse une comparaison qui n'en est pas une", () => {
    // Un prix « barré » inférieur au prix réel est une saisie fautive, pas une
    // promotion négative.
    expect(percentOff(100, 80)).toBeNull();
    expect(percentOff(100, 100)).toBeNull();
  });
});

describe("monogram", () => {
  it("prend les initiales de deux mots", () => {
    expect(monogram("Mohamed Karray")).toBe("MK");
  });

  it("prend deux lettres d'un mot seul", () => {
    expect(monogram("Electro")).toBe("EL");
  });

  it("coupe aussi sur les tirets et les tirets longs", () => {
    expect(monogram("Ben-Ali")).toBe("BA");
    expect(monogram("Chez Slim — Gafsa")).toBe("CS");
  });

  it("ne rend jamais une chaîne vide", () => {
    // Un avatar sans initiales est un rond gris que personne ne sait lire.
    expect(monogram("")).toBe("??");
    expect(monogram("   ")).toBe("??");
  });
});

describe("fullName et shortName", () => {
  it("assemblent ce qui existe", () => {
    expect(fullName({ first_name: "Achref", last_name: "Mokhtar" })).toBe("Achref Mokhtar");
    expect(shortName({ first_name: "Achref", last_name: "Mokhtar" })).toBe("Achref M.");
  });

  it("survivent à un nom de famille manquant", () => {
    // Très fréquent : beaucoup de comptes n'ont qu'un prénom.
    expect(fullName({ first_name: "Achref", last_name: null })).toBe("Achref");
    expect(shortName({ first_name: "Achref", last_name: null })).toBe("Achref");
  });

  it("rendent une chaîne vide sans profil, jamais « null »", () => {
    expect(fullName(null)).toBe("");
    expect(shortName(undefined)).toBe("");
  });
});

describe("ressembleAUneAdresseEmail", () => {
  it("repère une adresse e-mail saisie comme nom de boutique", () => {
    // Le cas réel qui a motivé la fonction : CAPSA PHONE s'était inscrite
    // avec son adresse en guise de nom, slugifiée telle quelle dans chaque
    // lien partagé (/boutique/touta-imed1-gmail-com).
    expect(ressembleAUneAdresseEmail("touta.imed1@gmail.com")).toBe(true);
  });

  it("laisse passer un nom de boutique ordinaire", () => {
    expect(ressembleAUneAdresseEmail("CAPSA PHONE")).toBe(false);
    expect(ressembleAUneAdresseEmail("Zara Mall Gafsa")).toBe(false);
  });
});

describe("cx", () => {
  it("écarte les branches non retenues", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("ne laisse pas d'espace parasite", () => {
    // Une classe vide en tête produisait « " a" », que Tailwind ignore mais
    // qui salit chaque comparaison de rendu.
    expect(cx(false, "a")).toBe("a");
    expect(cx()).toBe("");
  });
});
