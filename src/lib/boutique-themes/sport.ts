import type { ThemeBoutique } from "./types";

/**
 * SPORT (+ Sport & Loisirs) — « Performance »
 *
 * Énergie, mouvement, diagonales assumées. Couvre les deux catégories
 * top-level `sport` et `sport-loisirs` (doublon noté dans TODO.md : même
 * thème pour les deux, sans toucher à la base) et toutes leurs
 * sous-catégories de loisirs.
 *
 * `accent` assombri à `#9c3620` : la première valeur (`#b23f22`) ne tenait
 * que 4.45:1 en badge (texte sur `accentDoux`) — sous le seuil AA.
 */
export const sportTheme: ThemeBoutique = {
  id: "sport",
  label: "Sport",
  ambiance: {
    nom: "Performance",
    concept: "Énergie et mouvement, pas un rayon sagement rangé.",
    emotion: "Dynamisme, envie de bouger.",
    principe: "Diagonales assumées, badges en ruban, peu de rondeur.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#fcf5f1",
      surface: "#ffffff",
      accent: "#9c3620",
      accentTexte: "#ffffff",
      accentDoux: "rgba(156,54,32,0.13)",
      accentFort: "#9c3620",
      text: "#241a15",
      muted: "#7a5d4e",
      border: "#f0d9c8",
    },
    sombre: {
      background: "#1f140e",
      surface: "#2b1d14",
      accent: "#e8784f",
      accentTexte: "#1f140e",
      accentDoux: "rgba(232,120,79,0.16)",
      accentFort: "#e8784f",
      text: "#f5e9e2",
      muted: "#cba593",
      border: "rgba(232,120,79,0.18)",
    },
  },
  accentSurClair: "#9c3620",
  typographie: {
    fontFamily: "var(--font-cairo), 'Cairo', system-ui, sans-serif",
    poidsTitre: 700,
    espacementLettres: "-0.01em",
  },
  formes: { rayon: "12px", rayonInterieur: "8px", badge: "ruban", ombre: "0 8px 22px rgba(156,54,32,0.12)" },
  couverture: {
    voile: {
      clair: "linear-gradient(115deg, rgba(156,54,32,0.26) 0%, rgba(10,10,14,0.1) 55%, rgba(10,10,14,0.4) 100%)",
      sombre: "linear-gradient(115deg, rgba(232,120,79,0.22) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.55) 100%)",
    },
    secours: "lignes-dynamiques",
  },
  productLayout: "showcase",
  promoStyle: { forme: "ruban", accentPropre: true },
  wheelStyle: {
    teintes: ["#9c3620", "#e8784f", "#f0a35c", "#241a15", "#c24d2e", "#f5c49a"],
    texteSurPartsClaires: "#241a15",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "De nouveaux équipements arrivent bientôt.", ar: "معدات جديدة قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités arrivent bientôt.", ar: "الأخبار قادمة قريبًا" },
  },
  animations: "nette",
  overridesAutorises: ["accent"],
};
