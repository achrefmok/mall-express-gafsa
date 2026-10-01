import type { ThemeBoutique } from "./types";

/**
 * SERVICES — « Professionnel simple »
 *
 * Catégorie inactive aujourd'hui, définie quand même. Le thème le plus
 * neutre de tous, volontairement : un métier de prestation générique, sans
 * identité sectorielle forte — gris-bleu sobre, aucune fioriture.
 */
export const servicesTheme: ThemeBoutique = {
  id: "services",
  label: "Services",
  ambiance: {
    nom: "Professionnel simple",
    concept: "Une prestation claire, sans décor superflu.",
    emotion: "Fiabilité.",
    principe: "Le thème le plus neutre de tous — aucune fioriture, aucune couleur appuyée.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f5f6f7",
      surface: "#ffffff",
      accent: "#3f4c58",
      accentTexte: "#ffffff",
      accentDoux: "rgba(63,76,88,0.1)",
      accentFort: "#3f4c58",
      text: "#1e242b",
      muted: "#596675",
      border: "#e2e6ea",
    },
    sombre: {
      background: "#12161b",
      surface: "#1a2029",
      accent: "#8294a6",
      accentTexte: "#12161b",
      accentDoux: "rgba(130,148,166,0.16)",
      accentFort: "#8294a6",
      text: "#e6e9ec",
      muted: "#a3aebb",
      border: "rgba(130,148,166,0.18)",
    },
  },
  accentSurClair: "#3f4c58",
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 600,
  },
  formes: { rayon: "14px", rayonInterieur: "10px", badge: "carre", ombre: "0 4px 14px rgba(63,76,88,0.08)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(10,12,14,0) 55%, rgba(10,12,14,0.3) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)",
    },
    secours: "aplat",
  },
  productLayout: "service",
  promoStyle: { forme: "carre", accentPropre: false },
  wheelStyle: {
    teintes: ["#3f4c58", "#8294a6", "#5a6b7a", "#1e242b", "#a3aebb", "#2c3640"],
    texteSurPartsClaires: "#1e242b",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "Les prestations arrivent bientôt.", ar: "الخدمات قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
