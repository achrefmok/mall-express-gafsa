import type { ThemeBoutique } from "./types";

/**
 * BIJOUTERIE — « Écrin », sombre par nature.
 *
 * L'écrin de velours, pas la vitrine éclairée au néon : fond presque noir,
 * un seul accent précieux (or), très peu de couleur ailleurs. Sombre dans
 * les deux modes, comme Électronique et Voitures — mais aucun des trois ne
 * se confond : bleu-cyan technique, rouge-anthracite mécanique, or-noir ici.
 *
 * `accentSurClair` assombri à `#846116` : l'or clair de l'accent
 * (`#c9a24a`) ne tient que 2.40:1 sur le cercle blanc translucide du bouton
 * retour — bien sous le seuil AA.
 */
const PALETTE_BIJOUTERIE = {
  background: "#141210",
  surface: "#1e1a16",
  accent: "#c9a24a",
  accentTexte: "#1a1510",
  accentDoux: "rgba(201,162,74,0.16)",
  accentFort: "#c9a24a",
  text: "#f3ede0",
  muted: "#a69a86",
  border: "#2b251e",
};

export const bijouterieTheme: ThemeBoutique = {
  id: "bijouterie",
  label: "Bijouterie",
  ambiance: {
    nom: "Écrin",
    concept: "Un écrin de velours, pas une vitrine éclairée au néon.",
    emotion: "Préciosité, confiance, discrétion.",
    principe: "Sombre par nature — or sur noir, un seul accent précieux, jamais de couleur superflue.",
  },
  sombreParNature: true,
  palettes: { clair: PALETTE_BIJOUTERIE, sombre: PALETTE_BIJOUTERIE },
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 600,
    espacementLettres: "0.01em",
  },
  accentSurClair: "#846116",
  formes: { rayon: "6px", rayonInterieur: "4px", badge: "carre", ombre: "0 10px 26px rgba(0,0,0,0.4)" },
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 100%)",
      sombre: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 100%)",
    },
    secours: "pictogramme-discret",
  },
  productLayout: "bijouterie",
  promoStyle: { forme: "carre", accentPropre: true },
  wheelStyle: {
    teintes: ["#c9a24a", "#8a6a1f", "#e6c878", "#141210", "#6f5214", "#f3ede0"],
    texteSurPartsClaires: "#1a1510",
    texteSurPartsSombres: "#f3ede0",
  },
  emptyState: {
    produits: { fr: "De nouvelles pièces arrivent bientôt.", ar: "قطع جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "douce",
  overridesAutorises: ["accent"],
};
