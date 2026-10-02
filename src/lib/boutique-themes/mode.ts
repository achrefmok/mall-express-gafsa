import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * MODE — « Vitrine éditoriale ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`. Seule la structure change : navigation à deux
 * niveaux genre → rayon, lookbook, filtre de taille
 * (`productLayout: "editorial"`, voir `ModeLayout`).
 */
export const modeTheme: ThemeBoutique = {
  id: "mode",
  label: "Mode",
  ambiance: {
    nom: "Vitrine éditoriale",
    concept: "Un feuillet de magazine de mode, pas une liste d'articles.",
    emotion: "Désirabilité, élégance posée.",
    principe: "Femme/Homme/Enfant en haut, le rayon change avec le genre choisi.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "editorial",
  },
  productLayout: "editorial",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "Votre prochaine pièce préférée arrive bientôt.", ar: "قطعتك المفضلة القادمة تصل قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités de la boutique arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
