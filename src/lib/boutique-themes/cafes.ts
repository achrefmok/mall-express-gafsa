import type { ThemeBoutique } from "./types";

/**
 * CAFÉS — « Salon de café », variante d'Alimentation
 *
 * Catégorie inactive aujourd'hui (`categories.is_active = false`), définie
 * quand même, sur demande explicite. Mêmes principes qu'Alimentation
 * (formes rondes, `productLayout: "menu"`), palette resserrée sur des
 * bruns et des crèmes — un café n'est pas un marché de produits frais.
 */
export const cafesTheme: ThemeBoutique = {
  id: "cafes",
  label: "Cafés",
  ambiance: {
    nom: "Salon de café",
    concept: "Un comptoir chaleureux, variante plus sobre d'Alimentation.",
    emotion: "Convivialité, pause.",
    principe: "Bruns et crèmes resserrés — pas l'orange franc du marché.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#faf5ee",
      surface: "#ffffff",
      accent: "#6b4a2f",
      accentTexte: "#ffffff",
      accentDoux: "rgba(107,74,47,0.13)",
      accentFort: "#6b4a2f",
      text: "#2e2015",
      muted: "#7d6650",
      border: "#ecdfd0",
    },
    sombre: {
      background: "#1d150e",
      surface: "#291f16",
      accent: "#c69163",
      accentTexte: "#1d150e",
      accentDoux: "rgba(198,145,99,0.16)",
      accentFort: "#c69163",
      text: "#f1e6d8",
      muted: "#c6ab8d",
      border: "rgba(181,130,82,0.18)",
    },
  },
  accentSurClair: "#6b4a2f",
  typographie: {
    fontFamily: "var(--font-reem-kufi), var(--font-cairo), 'Cairo', system-ui, sans-serif",
    googleFont: { nom: "Reem Kufi", poids: [500], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 500,
  },
  formes: { rayon: "22px", rayonInterieur: "16px", badge: "ruban", ombre: "0 8px 20px rgba(107,74,47,0.1)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(40,25,10,0) 40%, rgba(40,25,10,0.35) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.12) 35%, rgba(0,0,0,0.55) 100%)",
    },
    secours: "texture-marche",
  },
  productLayout: "menu",
  promoStyle: { forme: "ruban", accentPropre: true },
  wheelStyle: {
    teintes: ["#6b4a2f", "#b58252", "#d9b88f", "#4a3220", "#8f6540", "#e8d3b5"],
    texteSurPartsClaires: "#2e2015",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "Le menu du café arrive bientôt.", ar: "قائمة المقهى قريبًا" },
    promos: { fr: "Aucune offre en ce moment, repassez au comptoir.", ar: "لا عروض حاليًا، مرّوا بالمقهى قريبًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
