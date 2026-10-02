import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * CAFÉS — « Salon de café », variante d'Alimentation.
 *
 * Catégorie inactive aujourd'hui (`categories.is_active = false`), définie
 * quand même, sur demande explicite. Mêmes principes qu'Alimentation
 * (`productLayout: "menu"`). Couleur, police et formes identiques à
 * l'app partout — voir `identite-app.ts`.
 */
export const cafesTheme: ThemeBoutique = {
  id: "cafes",
  label: "Cafés",
  ambiance: {
    nom: "Salon de café",
    concept: "Un comptoir chaleureux, variante d'Alimentation.",
    emotion: "Convivialité, pause.",
    principe: "Photo, description courte, prix — comme Alimentation.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "texture-marche",
  },
  productLayout: "menu",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "Le menu du café arrive bientôt.", ar: "قائمة المقهى قريبًا" },
    promos: { fr: "Aucune offre en ce moment, repassez au comptoir.", ar: "لا عروض حاليًا، مرّوا بالمقهى قريبًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
