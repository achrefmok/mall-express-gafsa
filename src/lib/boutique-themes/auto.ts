import type { ThemeBoutique } from "./types";

/**
 * VOITURES & MOTOS — « Garage premium », sombre par nature.
 *
 * Anthracite neutre et rouge, jamais bleuté : c'est ce qui l'écarte
 * d'Électronique, l'autre thème sombre. Accent `#c13a24`, confirmé par
 * `scripts/check-theme-contrast.mjs` — la première valeur envisagée
 * (`#d8432c`) ne tenait que 4.4:1 avec du texte blanc, sous le seuil AA.
 *
 * `accentFort` (le rouge posé en texte sur `accentDoux`, dans le badge) est
 * délibérément plus clair que `accent` (le rouge du bouton plein) :
 * `#c13a24` sur un fond aussi dilué que 16 % ne tenait que 2.92:1 — le badge
 * a besoin d'un rouge plus clair, le bouton d'un rouge plus soutenu.
 */
const PALETTE_VOITURES = {
  background: "#17181b",
  surface: "#212327",
  accent: "#c13a24",
  accentTexte: "#ffffff",
  accentDoux: "rgba(193,58,36,0.16)",
  accentFort: "#e06a52",
  text: "#eceef0",
  muted: "#9aa0a6",
  border: "#2c2f33",
};

export const autoTheme: ThemeBoutique = {
  id: "auto",
  label: "Voitures & motos",
  ambiance: {
    nom: "Garage premium",
    concept: "Un showroom automobile, pas un dépôt.",
    emotion: "Puissance maîtrisée.",
    principe: "Anthracite neutre et rouge — jamais le bleu nuit d'Électronique.",
  },
  sombreParNature: true,
  palettes: { clair: PALETTE_VOITURES, sombre: PALETTE_VOITURES },
  typographie: {
    // Changa, réemployée depuis Électronique mais plus grasse : la
    // distinction tient à la couleur et au poids, pas à une septième police.
    fontFamily: "var(--font-changa), var(--font-cairo), 'Cairo', system-ui, sans-serif",
    googleFont: { nom: "Changa", poids: [700], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 700,
    espacementLettres: "-0.015em",
  },
  // Même chose que pour Électronique : le rouge clair du badge (3.31:1) ne
  // suffit pas sur blanc, un rouge plus sombre porte la flèche de retour.
  accentSurClair: "#9c2f1c",
  formes: { rayon: "10px", rayonInterieur: "8px", badge: "carre", ombre: "0 8px 22px rgba(0,0,0,0.35)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(8,8,10,0.1), rgba(8,8,10,0.6))",
      sombre: "linear-gradient(180deg, rgba(8,8,10,0.1), rgba(8,8,10,0.6))",
    },
    secours: "lignes-dynamiques",
  },
  productLayout: "vehicule",
  promoStyle: { forme: "carre", accentPropre: false },
  wheelStyle: {
    teintes: ["#c13a24", "#e06a52", "#3a3a3f", "#6b5f5b", "#17181b", "#9f3122"],
    texteSurPartsClaires: "#17181b",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux véhicules arrivent bientôt.", ar: "مركبات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours sur ce garage.", ar: "لا عروض حاليًا في هذا المرآب" },
    posts: { fr: "Les actualités du garage arrivent bientôt.", ar: "أخبار المرآب قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
