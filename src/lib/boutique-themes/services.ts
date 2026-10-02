import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * SERVICES — « Professionnel simple ».
 *
 * Catégorie inactive aujourd'hui, définie quand même. Couleur, police et
 * formes identiques à l'app partout — voir `identite-app.ts`.
 */
export const servicesTheme: ThemeBoutique = {
  id: "services",
  label: "Services",
  ambiance: {
    nom: "Professionnel simple",
    concept: "Une prestation claire, sans décor superflu.",
    emotion: "Fiabilité.",
    principe: "Prix + bouton contact mis en avant — voir productLayout « service ».",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "aplat",
  },
  productLayout: "service",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "Les prestations arrivent bientôt.", ar: "الخدمات قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
