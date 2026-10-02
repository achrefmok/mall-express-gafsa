import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * ALIMENTATION (+ Cafés) — « Marché chaleureux ».
 *
 * C'est aussi ici que « restaurant » trouve sa place : la catégorie
 * n'existe pas dans `public.categories`, et son besoin — photo,
 * description courte, prix — est exactement celui d'un commerce
 * alimentaire (`productLayout: "menu"`). Couleur, police et formes
 * identiques à l'app partout — voir `identite-app.ts`.
 */
export const alimentationTheme: ThemeBoutique = {
  id: "alimentation",
  label: "Alimentation",
  ambiance: {
    nom: "Marché chaleureux",
    concept: "Un étal, pas un entrepôt.",
    emotion: "Appétit, convivialité.",
    principe: "Photo, description courte, prix — jamais cachés derrière un clic.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "texture-marche",
  },
  productLayout: "menu",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "Le menu se prépare, revenez bientôt 🍽️", ar: "القائمة قيد التحضير، عودوا قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités du commerce arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "rebond",
  overridesAutorises: ["accent"],
};
