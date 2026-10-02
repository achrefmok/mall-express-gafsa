import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * PARAPHARMACIE — « Besoins & packs ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`. Seule la structure change : chips « besoin », packs,
 * « composez votre pack » (`productLayout: "catalog"`, partagée avec
 * Fête — le dispatch vérifie `theme.id`, voir `ParapharmacieLayout`).
 */
export const parapharmacieTheme: ThemeBoutique = {
  id: "parapharmacie",
  label: "Parapharmacie",
  ambiance: {
    nom: "Besoins & packs",
    concept: "On vient pour un besoin précis, pas pour une marque.",
    emotion: "Réassurance, efficacité.",
    principe: "Chips de besoin, packs — jamais un prix composé qui fait foi côté client.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "aplat",
  },
  productLayout: "catalog",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux produits arrivent bientôt.", ar: "منتجات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
