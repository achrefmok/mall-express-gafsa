import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * SANTÉ — « Cabinet rassurant ».
 *
 * C'est un métier de prestation, pas de produits
 * (`productLayout: "service"`) : la fiche met en avant le contact ou la
 * prise de rendez-vous plutôt qu'un panier. Pas de croix — emblème
 * protégé (Croix-Rouge) ; le pictogramme de secours utilise un
 * stéthoscope, une pulsation ou une feuille. Couleur, police et formes
 * identiques à l'app partout — voir `identite-app.ts`.
 */
export const santeTheme: ThemeBoutique = {
  id: "sante",
  label: "Santé",
  ambiance: {
    nom: "Cabinet rassurant",
    concept: "La clarté d'un cabinet propre, jamais froide.",
    emotion: "Sérénité, sérieux sans distance.",
    principe: "Peu de promotion, beaucoup de contact — le rendez-vous prime sur l'achat.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "pictogramme-discret",
  },
  productLayout: "service",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: {
      fr: "Les prestations de ce cabinet seront bientôt en ligne.",
      ar: "خدمات هذا المركز قريبًا على الإنترنت",
    },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités du cabinet arrivent bientôt.", ar: "أخبار المركز قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
