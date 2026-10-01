import type { ThemeBoutique } from "./types";

/**
 * MAISON (+ Équipements pour la maison) — « Studio d'intérieur »
 *
 * Catalogue déco épuré, calme. L'opposé de Sport : vert sauge, beaucoup
 * d'espace, presque aucune animation — la sobriété est le principe visuel
 * lui-même, pas un manque d'idée.
 */
export const maisonTheme: ThemeBoutique = {
  id: "maison",
  label: "Maison",
  ambiance: {
    nom: "Studio d'intérieur",
    concept: "Un catalogue déco épuré, pas un entrepôt de meubles.",
    emotion: "Calme, envie d'aménager.",
    principe: "Vert sauge, beaucoup d'espace blanc, presque aucune animation.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f6f8f3",
      surface: "#ffffff",
      accent: "#4f6e45",
      accentTexte: "#ffffff",
      accentDoux: "rgba(79,110,69,0.13)",
      accentFort: "#4f6e45",
      text: "#232a1f",
      muted: "#5f6c57",
      border: "#dfe6d7",
    },
    sombre: {
      background: "#161c12",
      surface: "#202a1a",
      accent: "#86b276",
      accentTexte: "#161c12",
      accentDoux: "rgba(134,178,118,0.16)",
      accentFort: "#86b276",
      text: "#e9f0e3",
      muted: "#aebba3",
      border: "rgba(134,178,118,0.18)",
    },
  },
  accentSurClair: "#4f6e45",
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 600,
  },
  formes: { rayon: "18px", rayonInterieur: "14px", badge: "carre", ombre: "0 4px 16px rgba(79,110,69,0.08)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(20,24,16,0) 50%, rgba(20,24,16,0.3) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)",
    },
    secours: "aplat",
  },
  productLayout: "maison",
  promoStyle: { forme: "carre", accentPropre: false },
  wheelStyle: {
    teintes: ["#4f6e45", "#86b276", "#9db28f", "#2f4728", "#c4d4bc", "#6b8f5f"],
    texteSurPartsClaires: "#232a1f",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouvelles pièces pour votre intérieur arrivent.", ar: "قطع جديدة لمنزلكم قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
