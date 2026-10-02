import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * ENSEIGNEMENT & FORMATION — « Apprentissage ».
 *
 * Un métier de prestation (`productLayout: "programme"`), pas de
 * produits classiques. Couleur, police et formes identiques à l'app
 * partout — voir `identite-app.ts`.
 */
export const enseignementTheme: ThemeBoutique = {
  id: "enseignement",
  label: "Enseignement & formation",
  ambiance: {
    nom: "Apprentissage",
    concept: "Un tableau de classe, pas un rayon de fournitures.",
    emotion: "Curiosité, sérieux accessible.",
    principe: "Durée et niveau dès qu'ils existent — voir productLayout « programme ».",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "grille",
  },
  productLayout: "programme",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux cours arrivent bientôt.", ar: "دورات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
