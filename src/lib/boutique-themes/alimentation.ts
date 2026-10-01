import type { ThemeBoutique } from "./types";

/**
 * ALIMENTATION (+ Cafés) — « Marché chaleureux »
 *
 * Étal de marché, produits qui donnent envie. C'est aussi ici que
 * « restaurant » trouve sa place : la catégorie n'existe pas dans
 * `public.categories`, et son besoin — photo, description courte, prix —
 * est exactement celui d'un commerce alimentaire (`productLayout: "menu"`).
 *
 * Contrastes vérifiés — texte 13.4:1 en clair, accentTexte/accent 4.8:1
 * (le minimum tenable pour un orange chaud sans le ternir).
 */
export const alimentationTheme: ThemeBoutique = {
  id: "alimentation",
  label: "Alimentation",
  ambiance: {
    nom: "Marché chaleureux",
    concept: "Un étal, pas un entrepôt : la photo donne faim avant que le nom ne se lise.",
    emotion: "Appétit, convivialité.",
    principe: "Formes rondes et pleines, description toujours visible — jamais cachée derrière un clic.",
  },
  sombreParNature: false,
  palettes: {
    clair: {
      background: "#fdf6ee",
      surface: "#ffffff",
      accent: "#b25a1c",
      accentTexte: "#ffffff",
      accentDoux: "rgba(178,90,28,0.12)",
      // Plus sombre que `accent` : sur un fond aussi dilué (12%), le ton de
      // bouton ne tenait que 3.85:1 en badge — insuffisant pour du texte.
      accentFort: "#8a4515",
      text: "#3a2612",
      muted: "#8a6b4c",
      border: "#f0ddc4",
    },
    sombre: {
      background: "#221a10",
      surface: "#2e2318",
      accent: "#e8965a",
      accentTexte: "#221a10",
      accentDoux: "rgba(232,150,90,0.16)",
      accentFort: "#e8965a",
      text: "#f5ead9",
      muted: "#c9a980",
      border: "rgba(232,150,90,0.18)",
    },
  },
  typographie: {
    fontFamily: "var(--font-reem-kufi), var(--font-cairo), 'Cairo', system-ui, sans-serif",
    googleFont: { nom: "Reem Kufi", poids: [500], sousEnsembles: ["latin", "arabic"] },
    poidsTitre: 500,
  },
  formes: { rayon: "24px", rayonInterieur: "18px", badge: "ruban", ombre: "0 8px 20px rgba(178,90,28,0.12)" },
  accentSurClair: "#8a4515",
  couverture: {
    voile: {
      clair: "linear-gradient(180deg, rgba(40,18,4,0) 40%, rgba(40,18,4,0.4) 100%)",
      sombre: "linear-gradient(180deg, rgba(10,6,2,0.15) 30%, rgba(10,6,2,0.6) 100%)",
    },
    secours: "texture-marche",
  },
  productLayout: "menu",
  promoStyle: { forme: "ruban", accentPropre: true },
  wheelStyle: {
    teintes: ["#b25a1c", "#d9762c", "#e8a35c", "#f0c07e", "#8a4a16", "#c96a1f"],
    texteSurPartsClaires: "#3a2612",
    texteSurPartsSombres: "#ffffff",
  },
  emptyState: {
    produits: { fr: "Le menu se prépare, revenez bientôt 🍽️", ar: "القائمة قيد التحضير، عودوا قريبًا" },
    promos: { fr: "Aucune offre en cours.", ar: "لا عروض حاليًا" },
    posts: { fr: "Les actualités du commerce arrivent bientôt.", ar: "أخبار المتجر قادمة قريبًا" },
  },
  animations: "rebond",
  overridesAutorises: ["accent"],
};
