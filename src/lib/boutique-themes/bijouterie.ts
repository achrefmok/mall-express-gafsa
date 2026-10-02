import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * BIJOUTERIE — « Écrin ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`. Seule la structure change : sélecteur de matière,
 * taille de bague, gravure (`productLayout: "bijouterie"`, voir
 * `BijouterieLayout`).
 */
export const bijouterieTheme: ThemeBoutique = {
  id: "bijouterie",
  label: "Bijouterie",
  ambiance: {
    nom: "Écrin",
    concept: "Un écrin, pas une vitrine ordinaire.",
    emotion: "Préciosité, confiance, discrétion.",
    principe: "La matière, la taille de bague et la gravure — jamais une couleur de métier à part.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "pictogramme-discret",
  },
  productLayout: "bijouterie",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouvelles pièces arrivent bientôt.", ar: "قطع جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
