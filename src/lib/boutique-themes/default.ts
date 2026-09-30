import type { ThemeBoutique } from "./types";

/**
 * DEFAULT — l'identité G-Mall actuelle, telle quelle.
 *
 * Pour toute boutique sans catégorie, et pour toute catégorie dont le
 * thème n'est pas encore construit (13 familles définies à l'étape 2,
 * seules `mode`, `alimentation` et `sante` sont implémentées à ce stade —
 * voir `index.ts`). Ce n'est pas un repli triste : c'est le design déjà en
 * place, repris sans changement.
 *
 * Les valeurs sombres sont **copiées telles quelles** de
 * `src/app/globals.css` (`@media (prefers-color-scheme: dark)`) plutôt que
 * recalculées : ce thème doit rester du même violet que le reste de
 * l'application, au pixel près.
 */
export const defaultTheme: ThemeBoutique = {
  id: "default",
  label: "G-Mall",
  ambiance: {
    nom: "G-Mall",
    concept: "L'identité de l'application, sans habillage métier.",
    emotion: "Familiarité.",
    principe: "Rien ne change tant qu'aucune catégorie n'est choisie.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f4f1fa",
      surface: "#ffffff",
      accent: "#6d4b8f",
      accentTexte: "#ffffff",
      accentDoux: "rgba(109,75,143,0.1)",
      accentFort: "#6d4b8f",
      text: "#241f2e",
      muted: "#635c74",
      border: "rgba(60,40,90,0.14)",
    },
    sombre: {
      background: "#17131f",
      surface: "#241d30",
      accent: "#7a54a0",
      accentTexte: "#ffffff",
      accentDoux: "rgba(189,154,222,0.16)",
      // `--color-brand` du mode sombre de l'app (globals.css), pas
      // `--color-brand-fill` : le premier est déjà éclairci pour porter du
      // texte sur un fond sombre, le second reste trop foncé en badge (2.38:1).
      accentFort: "#bd9ade",
      text: "#ece8f2",
      muted: "#b3abc0",
      border: "rgba(200,180,230,0.2)",
    },
  },
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 600,
  },
  formes: { rayon: "24px", rayonInterieur: "19px", badge: "pilule", ombre: "0 10px 24px rgba(60,40,90,0.09)" },
  couverture: {
    voile: { clair: "none", sombre: "none" },
    secours: "aucun",
  },
  productLayout: "grid",
  promoStyle: { forme: "pilule", accentPropre: false },
  wheelStyle: {
    teintes: ["#6d4b8f", "#8a5fb0", "#5a3a78", "#9a6fc0", "#4a2f66", "#7d54a0"],
    texteSurPartsClaires: "#241f2e",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "Rien pour le moment.", ar: "لا شيء حاليًا" },
    posts: { fr: "Les actualités de la boutique arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
