import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * FÊTE & ÉVÉNEMENTS — « Célébration ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`.
 */
export const feteTheme: ThemeBoutique = {
  id: "fete",
  label: "Fête & Événements",
  ambiance: {
    nom: "Célébration",
    concept: "Une salle de réception haut de gamme, pas un anniversaire d'enfant.",
    emotion: "Joie, occasion spéciale.",
    principe: "Salle ou prestation événementielle en catalogue — voir productLayout « catalog ».",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "confettis",
  },
  productLayout: "catalog",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouvelles offres pour vos événements arrivent.", ar: "عروض جديدة لمناسباتكم قريبًا" },
    promos: { fr: "Aucune offre en cours, revenez bientôt.", ar: "لا عروض حاليًا، عودوا قريبًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
