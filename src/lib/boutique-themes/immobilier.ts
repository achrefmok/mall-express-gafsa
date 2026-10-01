import type { ThemeBoutique } from "./types";

/**
 * IMMOBILIER — « Vitrine de biens »
 *
 * Architecture, sérieux professionnel. Lignes droites, rayon quasi nul,
 * fiches plutôt que vignettes — c'est un métier de prestation adjacent au
 * produit, pas un produit classique (voir `productLayout`).
 *
 * `showcase-fiche` se dégrade proprement vers une grille classique tant
 * qu'aucun champ structuré (surface, pièces, localisation) n'existe sur
 * `products` — voir TODO.md, aucune migration appliquée pour l'instant.
 */
export const immobilierTheme: ThemeBoutique = {
  id: "immobilier",
  label: "Immobilier",
  ambiance: {
    nom: "Vitrine de biens",
    concept: "Une fiche de bien, pas une vignette de boutique.",
    emotion: "Confiance, projection.",
    principe: "Lignes droites, rayon quasi nul — le sérieux avant la fantaisie.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f4f7fa",
      surface: "#ffffff",
      accent: "#28405a",
      accentTexte: "#ffffff",
      accentDoux: "rgba(40,64,90,0.1)",
      accentFort: "#28405a",
      text: "#1a232e",
      muted: "#51607a",
      border: "#dbe4ec",
    },
    sombre: {
      background: "#101722",
      surface: "#17202e",
      accent: "#80a3c6",
      accentTexte: "#101722",
      accentDoux: "rgba(128,163,198,0.16)",
      accentFort: "#80a3c6",
      text: "#e6ecf3",
      muted: "#9fb0c7",
      border: "rgba(111,147,184,0.18)",
    },
  },
  accentSurClair: "#28405a",
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 700,
  },
  formes: { rayon: "10px", rayonInterieur: "8px", badge: "carre", ombre: "0 6px 18px rgba(40,64,90,0.1)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(10,14,20,0) 50%, rgba(10,14,20,0.35) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.55) 100%)",
    },
    secours: "architecture",
  },
  productLayout: "showcase-fiche",
  promoStyle: { forme: "carre", accentPropre: false },
  wheelStyle: {
    teintes: ["#28405a", "#6f93b8", "#3a5a78", "#1a232e", "#9fb0c7", "#4a6f94"],
    texteSurPartsClaires: "#1a232e",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux biens seront bientôt disponibles.", ar: "عقارات جديدة ستتوفر قريبًا" },
    promos: { fr: "Aucune offre en cours sur ces biens.", ar: "لا عروض حاليًا على هذه العقارات" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
