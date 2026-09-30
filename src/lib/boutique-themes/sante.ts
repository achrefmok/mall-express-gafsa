import type { ThemeBoutique } from "./types";

/**
 * SANTÉ — « Cabinet rassurant »
 *
 * Propreté clinique douce, confiance. C'est un métier de prestation, pas de
 * produits (`productLayout: "service"`) : la fiche met en avant le contact
 * ou la prise de rendez-vous plutôt qu'un panier.
 *
 * Pas de croix — c'est un emblème protégé (Croix-Rouge). Le pictogramme de
 * secours (`secours: "pictogramme-discret"`) utilise un stéthoscope, une
 * pulsation ou une feuille, jamais une croix, jamais une couleur alarmante.
 *
 * Contrastes vérifiés — `muted` assombri à `#4d6c6a` (5.36:1) après un
 * premier essai à `#5c7c79` qui échouait de justesse (4.27:1).
 */
export const santeTheme: ThemeBoutique = {
  id: "sante",
  label: "Santé",
  ambiance: {
    nom: "Cabinet rassurant",
    concept: "La clarté d'un cabinet propre, jamais froide.",
    emotion: "Sérénité, sérieux sans distance.",
    principe: "Peu de promotion, beaucoup de contact — le rendez-vous prime sur l'achat.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#f2f9f8",
      surface: "#ffffff",
      accent: "#226e6a",
      accentTexte: "#ffffff",
      accentDoux: "rgba(34,110,106,0.12)",
      accentFort: "#226e6a",
      text: "#1a2b2a",
      muted: "#4d6c6a",
      border: "#d9ecea",
    },
    sombre: {
      background: "#0f1f1d",
      surface: "#16302c",
      accent: "#4fb3ac",
      accentTexte: "#0f1f1d",
      accentDoux: "rgba(79,179,172,0.16)",
      accentFort: "#4fb3ac",
      text: "#e6f5f2",
      muted: "#8fb5b0",
      border: "rgba(79,179,172,0.18)",
    },
  },
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 500,
  },
  formes: { rayon: "20px", rayonInterieur: "16px", badge: "pilule", ombre: "0 4px 14px rgba(34,110,106,0.08)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(10,20,20,0) 55%, rgba(10,20,20,0.22) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.45) 100%)",
    },
    secours: "pictogramme-discret",
  },
  productLayout: "service",
  promoStyle: { forme: "carre", accentPropre: false },
  wheelStyle: {
    teintes: ["#226e6a", "#3a8f8a", "#5cb0aa", "#7fb8b4", "#1a5551", "#2f8f8a"],
    texteSurPartsClaires: "#0f1f1d",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: {
      fr: "Les prestations de ce cabinet seront bientôt en ligne.",
      ar: "خدمات هذا المركز قريبًا على الإنترنت",
    },
    posts: { fr: "Les actualités du cabinet arrivent bientôt.", ar: "أخبار المركز قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
