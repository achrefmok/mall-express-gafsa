/**
 * Les types du système de thèmes — un thème par famille de catégorie, pas
 * par boutique. Voir `index.ts` pour la table de correspondance et
 * `README.md` (à venir) pour la direction artistique complète.
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

/**
 * Une palette complète pour un mode d'affichage (clair ou sombre).
 *
 * `accentTexte` n'est pas déduit automatiquement : la couleur de texte à
 * poser sur un accent clair (jaune, cyan…) n'est pas la même que sur un
 * accent sombre, et le script `scripts/check-theme-contrast.mjs` vérifie
 * cette paire précisément — mieux vaut la choisir soi-même que la calculer
 * à la volée et découvrir un échec de contraste en production.
 */
export interface PaletteMode {
  background: string;
  surface: string;
  accent: string;
  accentTexte: string;
  /** Fond très dilué de l'accent — le badge "ouvert maintenant", par exemple. */
  accentDoux: string;
  /** Le ton posé en texte sur `accentDoux` — presque toujours `accent` lui-même. */
  accentFort: string;
  text: string;
  muted: string;
  border: string;
}

export type ProductLayout =
  | "grid" // la grille actuelle — thème par défaut
  | "editorial" // grande photo, peu de texte (Mode)
  | "menu" // photo, description courte, prix (Alimentation, Cafés)
  | "technical" // caractéristique clé visible (Électronique)
  | "showcase" // grande image, badges (Sport)
  | "showcase-fiche" // surface/pièces/localisation si présents (Immobilier)
  | "vehicule" // marque/modèle/année/km si présents (Voitures)
  | "programme" // durée/niveau si présents (Enseignement)
  | "service" // prestation : prix + bouton contact/réservation mis en avant (Santé, Services)
  | "catalog"; // salle/prestation événementielle (Fête)

export type FormeBadge = "pilule" | "ruban" | "carre";

export type StyleAnimation = "aucune" | "douce" | "nette" | "rebond";

export interface TypographieTheme {
  /** Empilement complet, Cairo toujours en repli final. */
  fontFamily: string;
  /**
   * Police Google chargée via `next/font/google`, si le thème en utilise
   * une — absente pour les thèmes qui ne varient que le poids de Cairo.
   */
  googleFont?: {
    nom: string;
    poids: number[];
    /** Sous-ensembles à charger — toujours arabe + latin quand la police les couvre. */
    sousEnsembles: string[];
  };
  poidsTitre: number;
  espacementLettres?: string;
}

export interface StyleCouverture {
  voile: { clair: string; sombre: string };
  motif?: string;
  motifTaille?: string;
  /**
   * Le fallback quand la boutique n'a pas de photo de couverture — un nom
   * qui documente l'intention, le rendu réel vit dans le composant
   * `CouvertureSecours` (à venir avec l'implémentation).
   */
  secours:
    | "editorial"
    | "grille"
    | "texture-marche"
    | "lignes-dynamiques"
    | "confettis"
    | "architecture"
    | "pictogramme-discret"
    | "aplat"
    | "aucun";
}

export interface StylePromo {
  forme: FormeBadge;
  /** `true` : le badge utilise l'accent du thème plutôt que le rouge universel. */
  accentPropre: boolean;
}

export interface StyleRoue {
  teintes: string[];
  texteSurPartsClaires: string;
  texteSurPartsSombres: string;
}

export interface TexteBilingue {
  fr: string;
  ar: string;
}

export interface ThemeBoutique {
  id: ThemeId;
  label: string;
  /** Nom d'ambiance, tel que défini à l'étape 2 (« Vitrine éditoriale »…). */
  ambiance: { nom: string; concept: string; emotion: string; principe: string };
  /**
   * Sombre par nature (Électronique, Voitures) : ce thème reste sombre même
   * quand le système est en mode clair — l'inverse d'un thème clair qui,
   * lui, bascule avec `prefers-color-scheme`.
   */
  sombreParNature: boolean;
  palettes: { clair: PaletteMode; sombre: PaletteMode };
  typographie: TypographieTheme;
  formes: { rayon: string; rayonInterieur: string; badge: FormeBadge; ombre: string };
  /**
   * Une teinte du thème, assez sombre pour rester lisible sur le cercle
   * blanc translucide de la flèche de retour — quel que soit le mode. Pour
   * un thème clair, c'est presque toujours `palettes.clair.accentFort` ;
   * pour un thème sombre par nature (Électronique, Voitures), c'est une
   * couleur à part : leur accent réel (cyan, rouge clair) ne tient pas 4.5:1
   * sur blanc, et `accentFort` de leur unique palette est déjà celui-là.
   */
  accentSurClair: string;
  couverture: StyleCouverture;
  productLayout: ProductLayout;
  promoStyle: StylePromo;
  wheelStyle: StyleRoue;
  emptyState: {
    produits: TexteBilingue;
    /** Gardé même si l'onglet est masqué : la source fait défaut, pas le thème — voir TODO.md. */
    posts: TexteBilingue;
  };
  animations: StyleAnimation;
  /**
   * Les jetons qu'un commerçant pourra un jour ajuster lui-même — une
   * liste fermée, jamais un objet libre : un vendeur ne doit pouvoir casser
   * ni la lisibilité ni la structure du thème, seulement le teinter un peu.
   * Non branché à l'implémentation actuelle — préparé pour plus tard.
   */
  overridesAutorises: Array<"accent">;
}

export const RAYON_BADGE: Record<FormeBadge, string> = {
  pilule: "999px",
  ruban: "4px",
  carre: "8px",
};

