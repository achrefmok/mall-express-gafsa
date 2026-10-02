import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * ANIMAUX — « Univers pet-friendly ».
 *
 * Catégorie inactive aujourd'hui, définie quand même. Couleur, police et
 * formes identiques à l'app partout — voir `identite-app.ts`.
 */
export const animauxTheme: ThemeBoutique = {
  id: "animaux",
  label: "Animaux",
  ambiance: {
    nom: "Univers pet-friendly",
    concept: "Un compagnon avant un produit.",
    emotion: "Tendresse, confiance.",
    principe: "Grille simple — rien de structurel à ce métier pour l'instant.",
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
  productLayout: "grid",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux produits pour vos compagnons arrivent.", ar: "منتجات جديدة لرفقائكم قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
