import type { CSSProperties } from "react";
import { RAYON_BADGE, type PaletteMode, type ThemeBoutique, type ThemeId } from "./types";
import { modeTheme } from "./mode";
import { alimentationTheme } from "./alimentation";
import { santeTheme } from "./sante";
import { defaultTheme } from "./default";
import { beauteTheme } from "./beaute";
import { electroniqueTheme } from "./electronique";
import { autoTheme } from "./auto";
import { feteTheme } from "./fete";

export type { ThemeBoutique, ThemeId, PaletteMode, ProductLayout } from "./types";

/** Le rayon à appliquer à un badge (« ouvert maintenant », promotion) selon le thème. */
export function rayonBadge(theme: ThemeBoutique): string {
  return RAYON_BADGE[theme.formes.badge];
}

/**
 * Les thèmes réellement construits. Treize familles ont été spécifiées à
 * l'étape 2 (direction artistique) ; trois sont implémentées ici, plus le
 * thème par défaut — sur demande explicite, pour validation dans le
 * navigateur avant de continuer. Une famille absente de ce registre retombe
 * sur `default` via `resolveTheme()`, jamais sur une erreur.
 */
export const THEMES: Record<string, ThemeBoutique> = {
  mode: modeTheme,
  alimentation: alimentationTheme,
  sante: santeTheme,
  default: defaultTheme,
  beaute: beauteTheme,
  electronique: electroniqueTheme,
  auto: autoTheme,
  fete: feteTheme,
};

/**
 * Chaque entrée vient d'un `slug` réel de `public.categories` (64 lignes
 * vérifiées le 30 septembre 2026). Les familles regroupent leurs
 * sous-catégories sous un seul thème — une sous-catégorie hérite toujours
 * du thème de son parent, jamais le contraire.
 *
 * Une catégorie mappée vers un `ThemeId` qui n'existe pas encore dans
 * `THEMES` (ex. "sport" aujourd'hui) retombe sur `default` dans
 * `resolveTheme()` — la table reste complète et vraie même si
 * l'implémentation est encore partielle.
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
  // Alimentation (les cafés en font partie)
  alimentation: "alimentation",
  cafes: "alimentation",
  // Maison
  maison: "maison",
  "equipement-maison": "maison",
  // Sport & loisirs — TODO.md : doublon sport / sport-loisirs, même thème pour les deux
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

/** Le thème d'une boutique, à partir du `slug` de sa catégorie principale. */
export function resolveTheme(slugCategorie: string | null | undefined): ThemeBoutique {
  if (!slugCategorie) return THEMES.default;
  const id = THEME_PAR_CATEGORIE[slugCategorie];
  return (id && THEMES[id]) || THEMES.default;
}

function versVariablesCss(palette: PaletteMode, prefixe: string): Record<string, string> {
  return {
    [`--${prefixe}-fond`]: palette.background,
    [`--${prefixe}-surface`]: palette.surface,
    [`--${prefixe}-accent`]: palette.accent,
    [`--${prefixe}-accent-texte`]: palette.accentTexte,
    [`--${prefixe}-accent-doux`]: palette.accentDoux,
    [`--${prefixe}-accent-fort`]: palette.accentFort,
    [`--${prefixe}-texte`]: palette.text,
    [`--${prefixe}-muted`]: palette.muted,
    [`--${prefixe}-bordure`]: palette.border,
  };
}

/**
 * Les variables CSS à poser sur le conteneur de la page boutique, en style
 * inline — c'est la palette **claire** (ou sombre, si le thème l'est par
 * nature) qui sert de valeur par défaut. Le basculement automatique vers le
 * mode sombre du système se fait par `<StyleSombreTheme>`, ci-dessous : un
 * style inline ne peut pas exprimer une media query.
 */
export function variablesTheme(theme: ThemeBoutique): CSSProperties {
  const base = theme.sombreParNature ? theme.palettes.sombre : theme.palettes.clair;
  const voile = theme.sombreParNature ? theme.couverture.voile.sombre : theme.couverture.voile.clair;
  return {
    ...versVariablesCss(base, "theme"),
    "--theme-rayon": theme.formes.rayon,
    "--theme-rayon-interieur": theme.formes.rayonInterieur,
    "--theme-police": theme.typographie.fontFamily,
    "--theme-voile": voile,
    "--theme-accent-sur-clair": theme.accentSurClair,
    "--pc-rayon": theme.formes.rayon,
    "--pc-rayon-interieur": theme.formes.rayonInterieur,
  } as CSSProperties;
}

/**
 * La feuille de style qui bascule un thème clair vers sa variante sombre
 * quand le système le demande — absente pour un thème "sombre par nature"
 * (Électronique, Voitures à venir), qui n'a rien à basculer : il affiche
 * déjà sa palette sombre en toute circonstance.
 */
export function reglesModeSombreTheme(theme: ThemeBoutique): string | null {
  if (theme.sombreParNature) return null;

  const vars = versVariablesCss(theme.palettes.sombre, "theme");
  vars["--theme-voile"] = theme.couverture.voile.sombre;
  const declarations = Object.entries(vars)
    .map(([nom, valeur]) => `${nom}: ${valeur};`)
    .join(" ");

  return `@media (prefers-color-scheme: dark) { [data-theme="${theme.id}"] { ${declarations} } }`;
}
