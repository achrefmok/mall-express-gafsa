import type { ThemeBoutique } from "./types";

/**
 * PARAPHARMACIE — « Besoins & packs »
 *
 * Vert clinique rassurant, clair — à l'opposé de Santé (cabinet médical,
 * plus feutré) : ici on vient pour un besoin précis (bébé, solaire, peau
 * sensible), pas pour une consultation. Formes nettes, badges en pilule
 * comme un comprimé.
 *
 * `accent` assombri à `#176f49` : un premier essai plus clair (`#1f8a5c`)
 * ne tenait que 4.33:1 en bouton plein et 3.44:1 en badge — sous le seuil
 * AA pour les deux.
 */
export const parapharmacieTheme: ThemeBoutique = {
  id: "parapharmacie",
  label: "Parapharmacie",
  ambiance: {
    nom: "Besoins & packs",
    concept: "On vient pour un besoin précis, pas pour une marque.",
    emotion: "Réassurance, efficacité.",
    principe: "Vert clinique net — formes en pilule, jamais le feutré du cabinet médical.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f2f8f4",
      surface: "#ffffff",
      accent: "#176f49",
      accentTexte: "#ffffff",
      accentDoux: "rgba(23,111,73,0.13)",
      accentFort: "#176f49",
      text: "#16261d",
      muted: "#4f6a5a",
      border: "#d8ebe0",
    },
    sombre: {
      background: "#0e1a14",
      surface: "#16251c",
      accent: "#4fc98a",
      accentTexte: "#0e1a14",
      accentDoux: "rgba(79,201,138,0.16)",
      accentFort: "#4fc98a",
      text: "#e3f5ec",
      muted: "#9fc3b0",
      border: "rgba(79,201,138,0.18)",
    },
  },
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 700,
  },
  accentSurClair: "#176f49",
  formes: { rayon: "18px", rayonInterieur: "14px", badge: "pilule", ombre: "0 8px 20px rgba(23,111,73,0.1)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(10,20,16,0) 50%, rgba(10,20,16,0.3) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.5) 100%)",
    },
    secours: "aplat",
  },
  productLayout: "catalog",
  promoStyle: { forme: "pilule", accentPropre: true },
  wheelStyle: {
    teintes: ["#176f49", "#4fc98a", "#9fc3b0", "#16261d", "#2f9e6a", "#c8e5d6"],
    texteSurPartsClaires: "#16261d",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux produits arrivent bientôt.", ar: "منتجات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
