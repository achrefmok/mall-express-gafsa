import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * VOITURES & MOTOS — « Garage premium ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`.
 */
export const autoTheme: ThemeBoutique = {
  id: "auto",
  label: "Voitures & motos",
  ambiance: {
    nom: "Garage premium",
    concept: "Un showroom automobile, pas un dépôt.",
    emotion: "Puissance maîtrisée.",
    principe: "Fiche par véhicule : marque, modèle, année, kilométrage dès qu'ils existent.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "lignes-dynamiques",
  },
  productLayout: "vehicule",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux véhicules arrivent bientôt.", ar: "مركبات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours sur ce garage.", ar: "لا عروض حاليًا في هذا المرآب" },
    posts: { fr: "Les actualités du garage arrivent bientôt.", ar: "أخبار المرآب قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
