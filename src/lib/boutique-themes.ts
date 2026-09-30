/**
 * Un thème visuel par activité, pas par boutique.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que ce fichier décide, et ce qu'il ne décide pas
 * ────────────────────────────────────────────────────────────────────────
 *
 * Il choisit l'ambiance — teinte d'accent, forme des cartes et des badges,
 * voile posé sur la photo de couverture, police des titres — selon la
 * catégorie de la boutique. Il ne touche jamais au nom, au logo, aux photos
 * ni aux informations du commerçant : ceux-ci restent dynamiques et
 * l'emportent toujours sur le thème, qui n'habille que ce qui les entoure.
 *
 * L'identité G-Mall (barre de navigation, boutons d'action principaux,
 * marque violette) reste la même partout : le thème est une couche
 * d'ambiance posée sur la page boutique, pas une declinaison du design
 * system entier.
 *
 * ────────────────────────────────────────────────────────────────────────
 * D'où viennent les treize thèmes
 * ────────────────────────────────────────────────────────────────────────
 *
 * `THEME_PAR_CATEGORIE` couvre chaque catégorie réellement présente dans
 * `public.categories` au 30 septembre 2026 (64 lignes, listées via une
 * lecture directe de la table — voir notamment
 * `supabase/migrations/20260916001000_categories_types_boutique.sql` et
 * `20260913002000_categorie_animaux.sql`) — aucune catégorie n'a été
 * inventée pour ce fichier.
 * Plusieurs sous-catégories partagent le thème de leur famille (toutes les
 * déclinaisons de « Mode » prennent le thème `mode`, quelle que soit leur
 * propre teinte de badge) ; une catégorie absente de la liste — une nouvelle
 * catégorie ajoutée après coup — retombe sur `default`, qui est l'habillage
 * actuel de l'application : rien ne casse tant que cette entrée n'est pas
 * ajoutée ici.
 */

export type ThemeId =
  | "mode"
  | "beaute"
  | "electronique"
  | "alimentation"
  | "maison"
  | "sport"
  | "sante"
  | "fete"
  | "immobilier"
  | "enseignement"
  | "auto"
  | "animaux"
  | "services"
  | "default";

export interface ThemeBoutique {
  id: ThemeId;
  /** Pour le débogage visuel uniquement — jamais affiché au client. */
  label: string;
  /** Teinte d'accent (remplace le violet de marque pour les éléments propres à cette page). */
  accent: string;
  accentDoux: string;
  accentFort: string;
  /** Voile posé sur la photo de couverture — jamais opaque : la photo du commerçant reste le sujet. */
  voileCouverture: string;
  /** Rayon des cartes produit et de la carte de couverture. */
  rayon: string;
  rayonInterieur: string;
  /** Empilement de police pour le nom de la boutique et les titres de section. */
  police: string;
  /** Texture de fond très discrète, propre à l'ambiance. */
  motif: string;
  /** Taille de répétition du motif — absent pour un dégradé unique (« cover »). */
  motifTaille?: string;
  /** Forme du badge « ouvert maintenant » / promotion. */
  badge: "pilule" | "ruban" | "carre";
}

const polices = {
  // Empilements de polices déjà présentes sur tout appareil — aucune police
  // supplémentaire à charger, donc aucun risque pour la performance ni le FOUC.
  elegante: "'Georgia', 'Times New Roman', serif",
  technique: "'Consolas', 'SFMono-Regular', 'Menlo', monospace",
  chaleureuse: "'Segoe UI', system-ui, sans-serif",
  sobre: "system-ui, sans-serif",
} as const;

const THEMES: Record<ThemeId, ThemeBoutique> = {
  mode: {
    id: "mode",
    label: "Mode",
    accent: "#b8558f",
    accentDoux: "rgba(184,85,143,0.12)",
    accentFort: "#8f3d6d",
    voileCouverture: "linear-gradient(180deg, rgba(20,10,20,0) 45%, rgba(20,10,20,0.35) 100%)",
    rayon: "28px",
    rayonInterieur: "22px",
    police: polices.elegante,
    motif: "none",
    badge: "pilule",
  },
  beaute: {
    id: "beaute",
    label: "Beauté",
    accent: "#c9598a",
    accentDoux: "rgba(201,89,138,0.14)",
    accentFort: "#a53f6c",
    voileCouverture:
      "linear-gradient(135deg, rgba(255,214,235,0.22), rgba(120,40,90,0.28))",
    rayon: "26px",
    rayonInterieur: "20px",
    police: polices.elegante,
    motif:
      "radial-gradient(circle at 12% 10%, rgba(255,255,255,0.5), transparent 45%)",
    badge: "pilule",
  },
  electronique: {
    id: "electronique",
    label: "Électronique",
    accent: "#3d6fd6",
    accentDoux: "rgba(61,111,214,0.12)",
    accentFort: "#2a4fa8",
    voileCouverture: "linear-gradient(180deg, rgba(8,12,24,0.05), rgba(8,12,24,0.45))",
    rayon: "14px",
    rayonInterieur: "10px",
    police: polices.technique,
    motif:
      "linear-gradient(rgba(61,111,214,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(61,111,214,0.06) 1px, transparent 1px)",
    motifTaille: "26px 26px",
    badge: "carre",
  },
  alimentation: {
    id: "alimentation",
    label: "Alimentation",
    accent: "#d9762c",
    accentDoux: "rgba(217,118,44,0.14)",
    accentFort: "#b25a1c",
    voileCouverture: "linear-gradient(180deg, rgba(40,18,4,0) 40%, rgba(40,18,4,0.4) 100%)",
    rayon: "24px",
    rayonInterieur: "18px",
    police: polices.chaleureuse,
    motif: "none",
    badge: "ruban",
  },
  maison: {
    id: "maison",
    label: "Maison",
    accent: "#6b8f5f",
    accentDoux: "rgba(107,143,95,0.12)",
    accentFort: "#4f6e45",
    voileCouverture: "linear-gradient(180deg, rgba(20,24,16,0) 50%, rgba(20,24,16,0.3) 100%)",
    rayon: "18px",
    rayonInterieur: "14px",
    police: polices.sobre,
    motif: "none",
    badge: "carre",
  },
  sport: {
    id: "sport",
    label: "Sport",
    accent: "#e0532f",
    accentDoux: "rgba(224,83,47,0.14)",
    accentFort: "#b23f22",
    voileCouverture:
      "linear-gradient(115deg, rgba(224,83,47,0.28) 0%, rgba(10,10,14,0.15) 55%, rgba(10,10,14,0.45) 100%)",
    rayon: "12px",
    rayonInterieur: "8px",
    police: polices.sobre,
    motif: "none",
    badge: "ruban",
  },
  sante: {
    id: "sante",
    label: "Santé",
    accent: "#2f8f8a",
    accentDoux: "rgba(47,143,138,0.12)",
    accentFort: "#226e6a",
    voileCouverture: "linear-gradient(180deg, rgba(10,20,20,0) 55%, rgba(10,20,20,0.25) 100%)",
    rayon: "20px",
    rayonInterieur: "16px",
    police: polices.sobre,
    motif: "none",
    badge: "pilule",
  },
  fete: {
    id: "fete",
    label: "Fête & Événements",
    accent: "#a855c9",
    accentDoux: "rgba(168,85,201,0.14)",
    accentFort: "#8138a3",
    voileCouverture:
      "linear-gradient(135deg, rgba(168,85,201,0.3), rgba(255,170,60,0.22))",
    rayon: "26px",
    rayonInterieur: "20px",
    police: polices.elegante,
    motif: "radial-gradient(circle at 90% 8%, rgba(255,255,255,0.35), transparent 40%)",
    badge: "ruban",
  },
  immobilier: {
    id: "immobilier",
    label: "Immobilier",
    accent: "#3a5a78",
    accentDoux: "rgba(58,90,120,0.12)",
    accentFort: "#28405a",
    voileCouverture: "linear-gradient(180deg, rgba(10,14,20,0) 50%, rgba(10,14,20,0.35) 100%)",
    rayon: "10px",
    rayonInterieur: "8px",
    police: polices.sobre,
    motif: "none",
    badge: "carre",
  },
  enseignement: {
    id: "enseignement",
    label: "Enseignement & formation",
    accent: "#4a5fd0",
    accentDoux: "rgba(74,95,208,0.12)",
    accentFort: "#3444a3",
    voileCouverture: "linear-gradient(180deg, rgba(10,12,24,0) 55%, rgba(10,12,24,0.3) 100%)",
    rayon: "16px",
    rayonInterieur: "12px",
    police: polices.sobre,
    motif: "none",
    badge: "pilule",
  },
  auto: {
    id: "auto",
    label: "Voitures & motos",
    accent: "#d0432f",
    accentDoux: "rgba(208,67,47,0.14)",
    accentFort: "#9f3122",
    voileCouverture: "linear-gradient(180deg, rgba(8,8,10,0.1), rgba(8,8,10,0.55))",
    rayon: "10px",
    rayonInterieur: "8px",
    police: polices.technique,
    motif: "none",
    badge: "carre",
  },
  animaux: {
    id: "animaux",
    label: "Animaux",
    accent: "#3d9e6f",
    accentDoux: "rgba(61,158,111,0.14)",
    accentFort: "#2c7a54",
    voileCouverture: "linear-gradient(180deg, rgba(10,20,16,0) 50%, rgba(10,20,16,0.3) 100%)",
    rayon: "26px",
    rayonInterieur: "20px",
    police: polices.chaleureuse,
    motif: "none",
    badge: "pilule",
  },
  services: {
    id: "services",
    label: "Services",
    accent: "#5a6b7a",
    accentDoux: "rgba(90,107,122,0.12)",
    accentFort: "#3f4c58",
    voileCouverture: "linear-gradient(180deg, rgba(10,12,14,0) 55%, rgba(10,12,14,0.3) 100%)",
    rayon: "14px",
    rayonInterieur: "10px",
    police: polices.sobre,
    motif: "none",
    badge: "carre",
  },
  default: {
    id: "default",
    label: "G-Mall",
    accent: "#6d4b8f",
    accentDoux: "rgba(109,75,143,0.1)",
    accentFort: "#5a3a78",
    voileCouverture: "none",
    rayon: "24px",
    rayonInterieur: "19px",
    police: polices.sobre,
    motif: "none",
    badge: "pilule",
  },
};

/**
 * Chaque entrée vient d'un `slug` réel de `public.categories`. Les familles
 * (mode, électronique, animaux, fête, immobilier, enseignement) regroupent
 * leurs sous-catégories sous un seul thème : c'est l'activité qui compte,
 * pas la nuance de badge que porte la sous-catégorie ailleurs dans l'app.
 */
const THEME_PAR_CATEGORIE: Record<string, ThemeId> = {
  // Mode
  mode: "mode",
  "mode-femme": "mode",
  "mode-homme": "mode",
  "mode-enfant": "mode",
  "mode-accessoires": "mode",
  "mode-chaussures": "mode",
  // Beauté
  beaute: "beaute",
  // Électronique
  electronique: "electronique",
  "electronique-telephones": "electronique",
  "electronique-ordinateurs": "electronique",
  "electronique-audio": "electronique",
  "electronique-accessoires": "electronique",
  "electronique-electromenager": "electronique",
  informatique: "electronique",
  // Alimentation (les cafés en font partie : même ambiance chaleureuse)
  alimentation: "alimentation",
  cafes: "alimentation",
  // Maison
  maison: "maison",
  "equipement-maison": "maison",
  // Sport & loisirs
  sport: "sport",
  "sport-loisirs": "sport",
  "loisirs-salles-sport": "sport",
  "loisirs-fitness": "sport",
  "loisirs-terrains": "sport",
  "loisirs-clubs": "sport",
  "loisirs-parcs-jeux": "sport",
  "loisirs-enfants": "sport",
  "loisirs-familles": "sport",
  // Santé
  sante: "sante",
  "medecin-generaliste": "sante",
  dentiste: "sante",
  specialiste: "sante",
  laboratoire: "sante",
  "kine-soins": "sante",
  // Fête & événements
  "fete-evenements": "fete",
  "fete-salles-fetes": "fete",
  "fete-salles-mariage": "fete",
  "fete-salles-reception": "fete",
  "fete-espaces": "fete",
  "fete-anniversaires": "fete",
  // Immobilier
  immobilier: "immobilier",
  "location-appartement": "immobilier",
  "location-maison": "immobilier",
  "vente-appartement": "immobilier",
  "vente-maison": "immobilier",
  terrain: "immobilier",
  "local-commercial": "immobilier",
  // Enseignement & formation
  enseignement: "enseignement",
  "ecole-privee": "enseignement",
  "cours-particuliers": "enseignement",
  "centre-formation": "enseignement",
  langues: "enseignement",
  "auto-ecole": "enseignement",
  // Voitures & motos
  "voitures-motos": "auto",
  // Animaux
  animaux: "animaux",
  "animaux-chiens": "animaux",
  "animaux-chats": "animaux",
  "animaux-oiseaux": "animaux",
  "animaux-poissons": "animaux",
  "animaux-nourriture": "animaux",
  "animaux-accessoires": "animaux",
  "animaux-toilettage": "animaux",
  "animaux-veterinaire": "animaux",
  // Services, et tout ce qui ne rentre dans aucune famille ci-dessus
  services: "services",
  autres: "default",
};

const RAYON_BADGE: Record<ThemeBoutique["badge"], string> = {
  pilule: "999px",
  ruban: "4px",
  carre: "8px",
};

/** Le rayon à appliquer à un badge (« ouvert maintenant », promotion) selon le thème. */
export function rayonBadge(theme: ThemeBoutique): string {
  return RAYON_BADGE[theme.badge];
}

/** Le thème de la boutique, à partir du `slug` de sa catégorie principale. */
export function themeDepuisCategorie(slug: string | null | undefined): ThemeBoutique {
  if (!slug) return THEMES.default;
  return THEMES[THEME_PAR_CATEGORIE[slug] ?? "default"];
}

/** Les variables CSS à poser sur le conteneur de la page boutique. */
export function variablesTheme(theme: ThemeBoutique): React.CSSProperties {
  return {
    "--theme-accent": theme.accent,
    "--theme-accent-doux": theme.accentDoux,
    "--theme-accent-fort": theme.accentFort,
    "--theme-rayon": theme.rayon,
    "--theme-rayon-interieur": theme.rayonInterieur,
    "--theme-police": theme.police,
    "--pc-rayon": theme.rayon,
    "--pc-rayon-interieur": theme.rayonInterieur,
  } as React.CSSProperties;
}
