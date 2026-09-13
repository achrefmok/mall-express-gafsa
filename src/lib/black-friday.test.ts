import { describe, expect, it } from "vitest";
import {
  bfEnVigueur,
  decompte,
  estVendredi,
  fenetreDuVendredi,
  formatDecompte,
  phaseCampagne,
  pourcentageReduction,
  prochainVendredi,
  statutOffre,
} from "./black-friday";

/*
  Le vendredi de référence : 27 novembre 2026. La fenêtre attendue est donc
  vendredi 00:01 heure de Tunis — soit jeudi 26 à 23:01 UTC — jusqu'à samedi
  00:01 heure de Tunis, soit vendredi 27 à 23:01 UTC.
*/
const VENDREDI = "2026-11-27";

describe("fenetreDuVendredi", () => {
  it("commence le vendredi à 00:01 heure de Tunis", () => {
    const { debut } = fenetreDuVendredi(VENDREDI);
    expect(debut.toISOString()).toBe("2026-11-26T23:01:00.000Z");
  });

  it("dure exactement vingt-quatre heures", () => {
    const { debut, fin } = fenetreDuVendredi(VENDREDI);
    expect(fin.getTime() - debut.getTime()).toBe(24 * 3600 * 1000);
    expect(fin.toISOString()).toBe("2026-11-27T23:01:00.000Z");
  });
});

describe("estVendredi", () => {
  it("reconnaît un vendredi", () => expect(estVendredi(VENDREDI)).toBe(true));
  it("refuse un jeudi", () => expect(estVendredi("2026-11-26")).toBe(false));
  it("refuse une date illisible", () => expect(estVendredi("pas-une-date")).toBe(false));
});

describe("phaseCampagne — les bornes à la seconde", () => {
  const { debut, fin } = fenetreDuVendredi(VENDREDI);

  it("une seconde avant l'ouverture : pas encore", () => {
    expect(phaseCampagne(debut, fin, debut.getTime() - 1000)).toBe("avant");
  });

  it("à 00:01 pile : actif", () => {
    expect(phaseCampagne(debut, fin, debut.getTime())).toBe("actif");
  });

  it("une seconde avant la fin : encore actif", () => {
    expect(phaseCampagne(debut, fin, fin.getTime() - 1000)).toBe("actif");
  });

  /*
    La borne de fin est exclue, comme dans la policy SQL (`now() < ends_at`).
    Si les deux divergeaient, l'écran annoncerait « actif » une seconde de trop
    — ou pire, le serveur appliquerait un prix que l'écran dit terminé.
  */
  it("samedi à 00:01 pile : terminé", () => {
    expect(phaseCampagne(debut, fin, fin.getTime())).toBe("termine");
  });

  it("sans campagne : aucune", () => {
    expect(phaseCampagne(null, null, Date.now())).toBe("aucune");
  });
});

describe("statutOffre", () => {
  it("désactivée avant la campagne : en préparation", () => {
    expect(statutOffre({ active: false, moderee: false }, "avant")).toBe("preparation");
  });

  it("activée avant la campagne : programmée", () => {
    expect(statutOffre({ active: true, moderee: false }, "avant")).toBe("programme");
  });

  it("activée pendant la campagne : active", () => {
    expect(statutOffre({ active: true, moderee: false }, "actif")).toBe("actif");
  });

  it("après la campagne, même activée : terminée", () => {
    expect(statutOffre({ active: true, moderee: false }, "termine")).toBe("termine");
  });

  it("modérée par l'administration : jamais active, même en pleine campagne", () => {
    expect(statutOffre({ active: true, moderee: true }, "actif")).toBe("modere");
  });
});

describe("pourcentageReduction", () => {
  it("250 → 179 donne −28 %", () => expect(pourcentageReduction(250, 179)).toBe(28));
  it("250 → 149 donne −40 %", () => expect(pourcentageReduction(250, 149)).toBe(40));

  it("un prix égal n'est pas une réduction", () => {
    expect(pourcentageReduction(100, 100)).toBeNull();
  });

  it("un prix supérieur n'est surtout pas affiché comme rabais", () => {
    expect(pourcentageReduction(100, 120)).toBeNull();
  });

  it("une réduction de moins d'un pour cent ne s'affiche pas", () => {
    expect(pourcentageReduction(1000, 998)).toBeNull();
  });

  it("jamais −100 %, même pour un prix symbolique", () => {
    expect(pourcentageReduction(1000, 0.001)).toBe(99);
  });
});

describe("prochainVendredi", () => {
  it("un mercredi : le vendredi de la même semaine", () => {
    expect(prochainVendredi(new Date("2026-11-25T10:00:00Z"))).toBe(VENDREDI);
  });

  it("un vendredi : ce vendredi-là", () => {
    expect(prochainVendredi(new Date("2026-11-27T10:00:00Z"))).toBe(VENDREDI);
  });

  /*
    Jeudi 23:30 UTC, c'est déjà vendredi 00:30 à Tunis. La date se lit dans
    le fuseau du mall, pas dans celui du serveur.
  */
  it("jeudi soir UTC, déjà vendredi à Tunis : ce vendredi", () => {
    expect(prochainVendredi(new Date("2026-11-26T23:30:00Z"))).toBe(VENDREDI);
  });

  it("un samedi : le vendredi suivant", () => {
    expect(prochainVendredi(new Date("2026-11-28T10:00:00Z"))).toBe("2026-12-04");
  });
});

describe("decompte et formatDecompte", () => {
  it("plus d'un jour : sans les secondes", () => {
    const ms = ((2 * 24 + 5) * 3600 + 32 * 60 + 17) * 1000;
    expect(formatDecompte(decompte(ms))).toBe("02j 05h 32m");
  });

  it("moins d'un jour : avec les secondes", () => {
    const ms = (12 * 3600 + 24 * 60 + 18) * 1000;
    expect(formatDecompte(decompte(ms))).toBe("12h 24m 18s");
  });

  it("une durée négative vaut zéro, et se dit écoulée", () => {
    const d = decompte(-5000);
    expect(d.ecoule).toBe(true);
    expect(formatDecompte(d)).toBe("00h 00m 00s");
  });
});

describe("bfEnVigueur — ce que la carte produit affiche", () => {
  const bf = { prix: 149, debut: "2026-11-26T23:01:00Z", fin: "2026-11-27T23:01:00Z" };

  it("rien sans offre", () => {
    expect(bfEnVigueur(null, Date.parse("2026-11-27T10:00:00Z"))).toBe(false);
    expect(bfEnVigueur(undefined, Date.parse("2026-11-27T10:00:00Z"))).toBe(false);
  });

  it("pas avant 00:01", () => {
    expect(bfEnVigueur(bf, Date.parse("2026-11-26T23:00:59Z"))).toBe(false);
  });

  it("en vigueur dès 00:01 et pendant la journée", () => {
    expect(bfEnVigueur(bf, Date.parse("2026-11-26T23:01:00Z"))).toBe(true);
    expect(bfEnVigueur(bf, Date.parse("2026-11-27T22:59:59Z"))).toBe(true);
  });

  it("retirée à 00:01 le samedi, même depuis une page en cache", () => {
    expect(bfEnVigueur(bf, Date.parse("2026-11-27T23:01:00Z"))).toBe(false);
  });
});
