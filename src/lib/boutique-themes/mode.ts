import type { ThemeBoutique } from "./types";

/**
 * MODE — « Vitrine éditoriale »
 *
 * Magazine de mode, pas boutique en ligne : grand vide, grande photo, texte
 * rare. Monochrome noir/blanc/crème — l'accent n'est jamais une couleur,
 * c'est le noir lui-même, employé avec parcimonie. Volontairement à
 * l'opposé de Beauté (rose poudré) : deux métiers voisins, deux ambiances
 * qui ne se confondent jamais.
 *
 * Contrastes vérifiés par `scripts/check-theme-contrast.mjs` — texte 17.2:1
 * en clair, 16.2:1 en sombre, accent/fond ≥ 16:1 dans les deux modes.
 */
export const modeTheme: ThemeBoutique = {
  id: "mode",
  label: "Mode",
  ambiance: {
    nom: "Vitrine éditoriale",
    concept: "Un feuillet de magazine de mode, pas une liste d'articles.",
    emotion: "Désirabilité, élégance posée.",
    principe: "Beaucoup de vide, une seule couleur — le noir — utilisée avec parcimonie.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#faf9f6",
      surface: "#ffffff",
      accent: "#161616",
      accentTexte: "#ffffff",
      accentDoux: "rgba(22,22,22,0.06)",
      accentFort: "#161616",
      text: "#161616",
      muted: "#6b6b6b",
      border: "#e4e1da",
    },
    sombre: {
      background: "#161616",
      surface: "#201f1d",
      accent: "#f4f2ee",
      accentTexte: "#161616",
      accentDoux: "rgba(244,242,238,0.12)",
      accentFort: "#f4f2ee",
      text: "#f4f2ee",
      muted: "#a8a8a8",
      border: "rgba(244,242,238,0.14)",
    },
  },
  typographie: {
    fontFamily: "var(--font-el-messiri), var(--font-cairo), 'Cairo', system-ui, sans-serif",
    googleFont: { nom: "El Messiri", poids: [600], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 600,
    espacementLettres: "-0.01em",
  },
  formes: { rayon: "28px", rayonInterieur: "22px", badge: "pilule", ombre: "0 2px 10px rgba(0,0,0,0.06)" },
  accentSurClair: "#161616",
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(20,20,20,0) 45%, rgba(20,20,20,0.32) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)",
    },
    secours: "editorial",
  },
  productLayout: "editorial",
  promoStyle: { forme: "pilule", accentPropre: false },
  wheelStyle: {
    teintes: ["#161616", "#3a3a3a", "#6b6b6b", "#9a9a9a", "#c7c2b8", "#e4e1da"],
    texteSurPartsClaires: "#161616",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "Votre prochaine pièce préférée arrive bientôt.", ar: "قطعتك المفضلة القادمة تصل قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités de la boutique arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
