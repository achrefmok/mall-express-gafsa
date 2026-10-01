import type { ThemeBoutique } from "./types";

/**
 * ÉLECTRONIQUE — « Vitrine technique », sombre par nature.
 *
 * Showroom high-tech : bleu nuit, cartes sombres, accent cyan électrique.
 * Sombre dans les deux modes, pas seulement en `prefers-color-scheme: dark`
 * — c'est ce qui la distingue de tout le reste, y compris de Voitures
 * (l'autre thème sombre, en anthracite neutre et rouge, jamais bleuté).
 *
 * Les deux palettes (`clair`/`sombre`) sont identiques : le type l'exige,
 * mais seule `sombre` est réellement utilisée, voir `sombreParNature` dans
 * `variablesTheme()` et `reglesModeSombreTheme()`.
 */
const PALETTE_ELECTRONIQUE = {
  background: "#0d1526",
  surface: "#141b30",
  accent: "#22d3ee",
  accentTexte: "#0b1220",
  accentDoux: "rgba(34,211,238,0.14)",
  accentFort: "#22d3ee",
  text: "#e8edf7",
  muted: "#8b96b8",
  border: "#232c47",
};

export const electroniqueTheme: ThemeBoutique = {
  id: "electronique",
  label: "Électronique",
  ambiance: {
    nom: "Vitrine technique",
    concept: "Un showroom high-tech, précis, sans fioriture.",
    emotion: "Confiance technique, clarté.",
    principe: "Sombre par nature — bleu nuit et cyan, jamais l'anthracite neutre de Voitures.",
  },
  sombreParNature: true,
  palettes: { clair: PALETTE_ELECTRONIQUE, sombre: PALETTE_ELECTRONIQUE },
  typographie: {
    fontFamily: "var(--font-changa), var(--font-cairo), 'Cairo', system-ui, sans-serif",
    googleFont: { nom: "Changa", poids: [600], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 600,
    espacementLettres: "-0.01em",
  },
  // Le cyan de l'accent ne tient pas 4.5:1 sur un cercle blanc translucide
  // (1.81:1) : un bleu-sarcelle bien plus sombre porte la flèche de retour.
  accentSurClair: "#134a56",
  formes: { rayon: "14px", rayonInterieur: "10px", badge: "carre", ombre: "0 8px 22px rgba(34,211,238,0.1)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(8,12,24,0.05), rgba(8,12,24,0.45))",
      sombre: "linear-gradient(180deg, rgba(8,12,24,0.05), rgba(8,12,24,0.45))",
    },
    motif:
      "linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)",
    motifTaille: "26px 26px",
    secours: "grille",
  },
  productLayout: "technical",
  promoStyle: { forme: "carre", accentPropre: true },
  wheelStyle: {
    teintes: ["#22d3ee", "#3d6fd6", "#5b7fd6", "#0d1526", "#8fdff0", "#2a4fa8"],
    texteSurPartsClaires: "#0b1220",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux produits tech arrivent bientôt.", ar: "منتجات تقنية جديدة قريبًا" },
    promos: { fr: "Aucune promotion en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités de la boutique arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
