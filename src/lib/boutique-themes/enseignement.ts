import type { ThemeBoutique } from "./types";

/**
 * ENSEIGNEMENT & FORMATION — « Apprentissage »
 *
 * Vert tableau, pas bleu — le bleu était déjà pris par Électronique et
 * Immobilier, et l'ancien essai y entrait en collision directe. Un métier
 * de prestation (`productLayout: "programme"`), pas de produits classiques.
 */
export const enseignementTheme: ThemeBoutique = {
  id: "enseignement",
  label: "Enseignement & formation",
  ambiance: {
    nom: "Apprentissage",
    concept: "Un tableau de classe, pas un rayon de fournitures.",
    emotion: "Curiosité, sérieux accessible.",
    principe: "Vert tableau — jamais le bleu d'Électronique ni d'Immobilier.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f4f7f2",
      surface: "#ffffff",
      accent: "#2f5d3a",
      accentTexte: "#ffffff",
      accentDoux: "rgba(47,93,58,0.12)",
      accentFort: "#2f5d3a",
      text: "#1c2a1f",
      muted: "#4f6353",
      border: "#dfe8d9",
    },
    sombre: {
      background: "#121a14",
      surface: "#1b251d",
      accent: "#6fa882",
      accentTexte: "#121a14",
      accentDoux: "rgba(111,168,130,0.16)",
      accentFort: "#6fa882",
      text: "#e9f0e4",
      muted: "#a7bba9",
      border: "rgba(111,168,130,0.18)",
    },
  },
  accentSurClair: "#2f5d3a",
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 600,
  },
  formes: { rayon: "16px", rayonInterieur: "12px", badge: "pilule", ombre: "0 6px 18px rgba(47,93,58,0.08)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(10,12,24,0) 55%, rgba(10,12,24,0.3) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.5) 100%)",
    },
    secours: "grille",
  },
  productLayout: "programme",
  promoStyle: { forme: "pilule", accentPropre: false },
  wheelStyle: {
    teintes: ["#2f5d3a", "#6fa882", "#bfa15a", "#1c2a1f", "#4f8a63", "#e0d2a0"],
    texteSurPartsClaires: "#1c2a1f",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux cours arrivent bientôt.", ar: "دورات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
