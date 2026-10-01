import type { ThemeBoutique } from "./types";

/**
 * ANIMAUX — « Univers pet-friendly »
 *
 * Catégorie inactive aujourd'hui, définie quand même. Vert tendre, formes
 * très rondes (façon coussinet), chaleureux sans reprendre l'orange
 * d'Alimentation ni le vert sauge de Maison.
 *
 * `accent` assombri à `#236b49` : la première valeur (`#2c7a54`) ne tenait
 * que 4.19:1 en badge — sous le seuil AA.
 */
export const animauxTheme: ThemeBoutique = {
  id: "animaux",
  label: "Animaux",
  ambiance: {
    nom: "Univers pet-friendly",
    concept: "Un compagnon avant un produit.",
    emotion: "Tendresse, confiance.",
    principe: "Formes très rondes, façon coussinet — jamais d'angle vif.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f3fbf6",
      surface: "#ffffff",
      accent: "#236b49",
      accentTexte: "#ffffff",
      accentDoux: "rgba(35,107,73,0.13)",
      accentFort: "#236b49",
      text: "#17251d",
      muted: "#4f6a5a",
      border: "#d9ece2",
    },
    sombre: {
      background: "#0e1a14",
      surface: "#16251c",
      accent: "#5bbf8c",
      accentTexte: "#0e1a14",
      accentDoux: "rgba(91,191,140,0.16)",
      accentFort: "#5bbf8c",
      text: "#e3f5ec",
      muted: "#9fc3b0",
      border: "rgba(91,191,140,0.18)",
    },
  },
  accentSurClair: "#236b49",
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 700,
  },
  formes: { rayon: "26px", rayonInterieur: "20px", badge: "pilule", ombre: "0 8px 20px rgba(35,107,73,0.1)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(10,20,16,0) 50%, rgba(10,20,16,0.3) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.5) 100%)",
    },
    secours: "aplat",
  },
  productLayout: "grid",
  promoStyle: { forme: "pilule", accentPropre: false },
  wheelStyle: {
    teintes: ["#236b49", "#5bbf8c", "#9fc3b0", "#17251d", "#3d9468", "#c8e5d6"],
    texteSurPartsClaires: "#17251d",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux produits pour vos compagnons arrivent.", ar: "منتجات جديدة لرفقائكم قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
