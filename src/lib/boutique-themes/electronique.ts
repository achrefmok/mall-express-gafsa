import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * ÉLECTRONIQUE — « Fiche technique ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`. Seule la structure change : recherche par modèle,
 * filtre marque, mini-stats, comparateur (`productLayout: "technical"`,
 * voir `ElectroniqueLayout`).
 */
export const electroniqueTheme: ThemeBoutique = {
  id: "electronique",
  label: "Électronique",
  ambiance: {
    nom: "Fiche technique",
    concept: "Une fiche technique à comparer, pas une vitrine de mode.",
    emotion: "Confiance technique, clarté.",
    principe: "Recherche par modèle, specs en mini-stats, comparateur.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "grille",
  },
  productLayout: "technical",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux produits tech arrivent bientôt.", ar: "منتجات تقنية جديدة قريبًا" },
    promos: { fr: "Aucune promotion en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités de la boutique arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
