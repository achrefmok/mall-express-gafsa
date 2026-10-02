import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * IMMOBILIER — « Vitrine de biens ».
 *
 * Fiches plutôt que vignettes — c'est un métier de prestation adjacent au
 * produit, pas un produit classique (voir `productLayout`). Se dégrade
 * proprement vers une grille classique tant qu'aucun champ structuré
 * (surface, pièces, localisation) n'existe — voir TODO.md. Couleur,
 * police et formes identiques à l'app partout — voir `identite-app.ts`.
 */
export const immobilierTheme: ThemeBoutique = {
  id: "immobilier",
  label: "Immobilier",
  ambiance: {
    nom: "Vitrine de biens",
    concept: "Une fiche de bien, pas une vignette de boutique.",
    emotion: "Confiance, projection.",
    principe: "Surface, pièces, localisation dès qu'elles existent — jamais inventées.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "architecture",
  },
  productLayout: "showcase-fiche",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux biens seront bientôt disponibles.", ar: "عقارات جديدة ستتوفر قريبًا" },
    promos: { fr: "Aucune offre en cours sur ces biens.", ar: "لا عروض حاليًا على هذه العقارات" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "aucune",
  overridesAutorises: ["accent"],
};
