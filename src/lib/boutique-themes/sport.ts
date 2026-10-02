import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * SPORT (+ Sport & Loisirs) — « Performance ».
 *
 * Couvre les deux catégories top-level `sport` et `sport-loisirs`
 * (doublon noté dans TODO.md : même thème pour les deux) et toutes leurs
 * sous-catégories de loisirs. Couleur, police et formes identiques à
 * l'app partout — voir `identite-app.ts`.
 */
export const sportTheme: ThemeBoutique = {
  id: "sport",
  label: "Sport",
  ambiance: {
    nom: "Performance",
    concept: "Énergie et mouvement, pas un rayon sagement rangé.",
    emotion: "Dynamisme, envie de bouger.",
    principe: "Grande image, badges — voir productLayout « showcase ».",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "lignes-dynamiques",
  },
  productLayout: "showcase",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux équipements arrivent bientôt.", ar: "معدات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
