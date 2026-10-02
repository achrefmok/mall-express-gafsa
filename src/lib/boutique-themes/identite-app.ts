import type { PaletteMode, StylePromo, StyleRoue, TypographieTheme } from "./types";

/**
 * L'identité visuelle G-Mall, partagée par tous les thèmes.
 *
 * Décision explicite : seule la **structure** de la page boutique change
 * par métier (`productLayout` — Mode a ses onglets Femme/Homme/Enfant,
 * Électronique sa liste de fiches techniques…), plus le texte d'ambiance
 * et les états vides. La couleur, la police et les formes restent celles
 * de l'application partout — jamais de fond ni d'accent différent d'une
 * famille à l'autre. Ce fichier est l'unique source de ces valeurs
 * communes ; chaque thème les reprend telles quelles plutôt que de les
 * dupliquer.
 *
 * Copié de `default.ts`, qui reste la référence (lui-même copié des
 * variables de `globals.css`).
 */
export const PALETTES_APP: { clair: PaletteMode; sombre: PaletteMode } = {
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
    accentFort: "#bd9ade",
    text: "#ece8f2",
    muted: "#b3abc0",
    border: "rgba(200,180,230,0.2)",
  },
};

export const TYPOGRAPHIE_APP: TypographieTheme = {
  fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
  poidsTitre: 600,
};

export const FORMES_APP = {
  rayon: "24px",
  rayonInterieur: "19px",
  badge: "pilule" as const,
  ombre: "0 10px 24px rgba(60,40,90,0.09)",
};

export const ACCENT_SUR_CLAIR_APP = "#6d4b8f";

export const VOILE_APP = {
  clair: "none",
  sombre: "none",
};

export const PROMO_STYLE_APP: StylePromo = { forme: "pilule", accentPropre: false };

export const WHEEL_STYLE_APP: StyleRoue = {
  teintes: ["#6d4b8f", "#8a5fb0", "#5a3a78", "#9a6fc0", "#4a2f66", "#7d54a0"],
  texteSurPartsClaires: "#241f2e",
  texteSurPartsSombres: "#ffffff",
};
