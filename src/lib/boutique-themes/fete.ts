import type { ThemeBoutique } from "./types";

/**
 * FÊTE & ÉVÉNEMENTS — « Célébration »
 *
 * Champagne/ivoire et or — plus de violet, corrigé après le premier essai
 * (bleu nuit) qui entrait en collision avec Électronique et se confondait
 * avec le thème par défaut. Une salle de mariage haut de gamme, pas un
 * anniversaire d'enfant.
 *
 * `accent` assombri à `#6f5620` : un or plus clair (`#9c7a2e`) ne tenait
 * que 4.01:1 avec du texte blanc — sous le seuil AA une fois posé en fond
 * de bouton.
 */
export const feteTheme: ThemeBoutique = {
  id: "fete",
  label: "Fête & Événements",
  ambiance: {
    nom: "Célébration",
    concept: "Une salle de réception haut de gamme, pas un anniversaire d'enfant.",
    emotion: "Joie, occasion spéciale.",
    principe: "Champagne et or — jamais de violet, pour ne pas se confondre avec l'identité par défaut.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#faf3e6",
      surface: "#ffffff",
      accent: "#6f5620",
      accentTexte: "#ffffff",
      accentDoux: "rgba(111,86,32,0.14)",
      accentFort: "#6f5620",
      text: "#3a2f1a",
      muted: "#6b5a34",
      border: "#eee0c8",
    },
    sombre: {
      background: "#1f1a10",
      surface: "#2b2417",
      accent: "#d4af6a",
      accentTexte: "#1f1a10",
      accentDoux: "rgba(212,175,106,0.18)",
      accentFort: "#d4af6a",
      text: "#f3ecd9",
      muted: "#b8a687",
      border: "rgba(212,175,106,0.18)",
    },
  },
  typographie: {
    // Un poids unique, très affirmé — réservée au nom et aux titres de
    // section, jamais au corps de texte : c'est une police d'affiche.
    fontFamily: "var(--font-lalezar), var(--font-cairo), 'Cairo', system-ui, sans-serif",
    googleFont: { nom: "Lalezar", poids: [400], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 400,
  },
  formes: { rayon: "26px", rayonInterieur: "20px", badge: "ruban", ombre: "0 10px 26px rgba(111,86,32,0.12)" },
  accentSurClair: "#6f5620",
  couverture: {
    voile: {
      clair: "linear-gradient(135deg, rgba(212,175,106,0.28), rgba(58,47,26,0.2))",
      sombre: "linear-gradient(135deg, rgba(212,175,106,0.22), rgba(10,8,4,0.55))",
    },
    motif: "radial-gradient(circle at 90% 8%, rgba(255,255,255,0.35), transparent 40%)",
    secours: "confettis",
  },
  productLayout: "catalog",
  promoStyle: { forme: "ruban", accentPropre: true },
  wheelStyle: {
    teintes: ["#6f5620", "#d4af6a", "#f3ecd9", "#9c7a2e", "#3a2f1a", "#b8965a"],
    texteSurPartsClaires: "#3a2f1a",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouvelles offres pour vos événements arrivent.", ar: "عروض جديدة لمناسباتكم قريبًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
