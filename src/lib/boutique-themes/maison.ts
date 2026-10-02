import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * MAISON (+ Équipements pour la maison) — « Par pièce ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`. Seule la structure change : chips de pièce, photo
 * d'ambiance, « Ajouter la pièce » (`productLayout: "maison"`, voir
 * `MaisonLayout`).
 */
export const maisonTheme: ThemeBoutique = {
  id: "maison",
  label: "Maison",
  ambiance: {
    nom: "Par pièce",
    concept: "Un catalogue rangé par pièce, pas un entrepôt de meubles.",
    emotion: "Calme, envie d'aménager.",
    principe: "Les chips de pièce ne montrent que ce que la boutique a vraiment renseigné.",
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
  productLayout: "maison",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouvelles pièces pour votre intérieur arrivent.", ar: "قطع جديدة لمنزلكم قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
