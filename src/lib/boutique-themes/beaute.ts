import type { ThemeBoutique } from "./types";

/**
 * BEAUTÉ — « Studio premium »
 *
 * Cabinet de beauté haut de gamme, lumière douce. Volontairement à
 * l'opposé de Mode (monochrome noir/blanc) : deux métiers voisins, deux
 * ambiances qui ne se confondent jamais — rose poudré/nude ici, jamais de
 * noir dominant.
 *
 * Amiri prévisualisée dans `/dev/boutique-themes` avant validation : rendu
 * calligraphique marqué en arabe, à l'usage réservé au nom de la boutique
 * et aux titres — jamais au corps de texte, qui reste en Cairo.
 *
 * `muted` assombri à `#7a606b` (5.31:1) après un premier essai à `#8a6b76`
 * qui échouait de justesse (4.44:1).
 */
export const beauteTheme: ThemeBoutique = {
  id: "beaute",
  label: "Beauté",
  ambiance: {
    nom: "Studio premium",
    concept: "Un cabinet de beauté haut de gamme, pas un rayon de supermarché.",
    emotion: "Soin, délicatesse, confiance.",
    principe: "Rose poudré et lumière douce — jamais de noir dominant, à l'opposé de Mode.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#fdf6f9",
      surface: "#ffffff",
      accent: "#a53f6c",
      accentTexte: "#ffffff",
      accentDoux: "rgba(165,63,108,0.12)",
      accentFort: "#a53f6c",
      text: "#2c1f26",
      muted: "#7a606b",
      border: "#f0dde5",
    },
    sombre: {
      background: "#241820",
      surface: "#2f1f29",
      accent: "#e0799f",
      accentTexte: "#241820",
      accentDoux: "rgba(224,121,159,0.16)",
      accentFort: "#e0799f",
      text: "#f8e9ee",
      muted: "#c9a3b2",
      border: "rgba(224,121,159,0.18)",
    },
  },
  typographie: {
    fontFamily: "var(--font-amiri), var(--font-cairo), 'Cairo', system-ui, serif",
    googleFont: { nom: "Amiri", poids: [400, 700], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 400,
  },
  formes: { rayon: "26px", rayonInterieur: "20px", badge: "pilule", ombre: "0 10px 26px rgba(165,63,108,0.1)" },
  accentSurClair: "#a53f6c",
  couverture: {
    voile: {
      clair: "linear-gradient(135deg, rgba(255,214,235,0.22), rgba(120,40,90,0.28))",
      sombre: "linear-gradient(135deg, rgba(60,20,40,0.35), rgba(10,5,10,0.6))",
    },
    motif: "radial-gradient(circle at 12% 10%, rgba(255,255,255,0.5), transparent 45%)",
    secours: "aplat",
  },
  productLayout: "beaute",
  promoStyle: { forme: "pilule", accentPropre: true },
  wheelStyle: {
    teintes: ["#a53f6c", "#c9598a", "#e0a3bb", "#8a3058", "#d4af6a", "#6d2a48"],
    texteSurPartsClaires: "#2c1f26",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux soins arrivent bientôt.", ar: "منتجات عناية جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités du studio arrivent bientôt.", ar: "أخبار المركز قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
