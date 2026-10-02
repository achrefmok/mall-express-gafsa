import type { ThemeBoutique } from "./types";
import { PALETTES_APP, TYPOGRAPHIE_APP, FORMES_APP, ACCENT_SUR_CLAIR_APP, VOILE_APP, PROMO_STYLE_APP, WHEEL_STYLE_APP } from "./identite-app";

/**
 * BEAUTÉ — « Studio premium ».
 *
 * Couleur, police et formes identiques à l'app partout — voir
 * `identite-app.ts`. Seule la structure change : trois onglets Maquillage/
 * Parfums/Soin, trouveur de teinte, pyramide olfactive
 * (`productLayout: "beaute"`, voir `BeauteLayout`).
 */
export const beauteTheme: ThemeBoutique = {
  id: "beaute",
  label: "Beauté",
  ambiance: {
    nom: "Studio premium",
    concept: "Un cabinet de beauté haut de gamme, pas un rayon de supermarché.",
    emotion: "Soin, délicatesse, confiance.",
    principe: "Trois onglets selon ce que la boutique vend vraiment — jamais un onglet vide.",
  },
  sombreParNature: false,
  palettes: PALETTES_APP,
  typographie: TYPOGRAPHIE_APP,
  formes: FORMES_APP,
  accentSurClair: ACCENT_SUR_CLAIR_APP,
  couverture: {
    voile: VOILE_APP,
    secours: "aplat",
  },
  productLayout: "beaute",
  promoStyle: PROMO_STYLE_APP,
  wheelStyle: WHEEL_STYLE_APP,
  emptyState: {
    produits: { fr: "De nouveaux soins arrivent bientôt.", ar: "منتجات عناية جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités du studio arrivent bientôt.", ar: "أخبار المركز قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
