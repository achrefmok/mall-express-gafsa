/**
 * Les « vitrines » : les métiers du handoff de design « Boutiques G-Mall
 * par catégorie » (Mode, Téléphones, Parfumerie…), chacun avec sa couleur,
 * son présentoir 360° et son filtre.
 *
 * Distinct du `ThemeId` (`src/lib/boutique-themes/`), volontairement : un
 * thème regroupe une famille de catégories (Électronique couvre téléphones
 * ET électroménager), une vitrine décrit un commerce précis — un magasin de
 * téléphones ne ressemble pas à un showroom d'électroménager. Une boutique
 * sans vitrine (bijouterie, maison, santé…) garde sa mise en page de thème
 * et la couleur de l'app.
 */

export type VitrineId =
  | "mode"
  | "telephones"
  | "parfumerie"
  | "cosmetiques"
  | "parapharmacie"
  | "electromenager"
  | "moto"
  | "patisserie"
  | "animalerie"
  | "sport"
  | "location";

export interface TexteBilingue {
  fr: string;
  ar: string;
}

/**
 * Le décor du présentoir — valeurs de l'objet `DISP` du prototype,
 * recopiées telles quelles. Ce sont des matériaux de scène (l'or d'un
 * portant, le marbre d'un plateau, le néon d'un socle de verre), pas des
 * couleurs d'identité : celles-ci restent les jetons `--theme-*`.
 */
export interface SceneVitrine {
  titre: TexteBilingue;
  /** Mode seulement : les cartes pendent à des fils sous un portant doré. */
  suspendu: boolean;
  fond: string;
  mur: string;
  lampe: string;
  cone: string;
  /** Plateau tournant — absent du portant suspendu, qui a son anneau doré. */
  disque?: string;
  bord?: string;
  ombreDisque?: string;
  carte: { largeur: number; hauteur: number; rayon: string; liseré: string };
  dos: string;
  marque: string;
  pastille: string;
  encrePastille: string;

  /*
    Réglages facultatifs — absents, le rendu est celui du handoff (scène
    sombre, bouton Pause, voile noir de profondeur). Mode s'en sert pour son
    showroom blanc ; aucune valeur visuelle n'est écrite dans le composant.
  */
  /** `false` : aucun bouton (ni Pause) — on tourne au doigt ou à la souris, c'est tout. */
  controles?: boolean;
  /** Rotation automatique au repos, en °/s (défaut −14). */
  vitesse?: number;
  /** Couleur vers laquelle s'estompent les pièces du fond (défaut noir) et son intensité max. */
  brume?: { couleur: string; max: number };
  /** Lueur ou ombre au sol sous le présentoir. */
  sol?: string;
  /** Le petit luminaire au plafond ; `null` : pas de luminaire. */
  luminaire?: string | null;
  /** Fond d'une carte avec photo, pendant le chargement. */
  fondCarte?: string;
  /** Bandeau nom + prix sur la carte : sombre (défaut) ou clair. */
  etiquette?: { fond: string; texte: string };
  /** Métal du portant suspendu (mât, boule, anneau, socle, fil, cintre). */
  metal?: {
    boule: string;
    mat: string;
    anneau: string;
    socleCentre: string;
    fil: string;
    cintre: string;
    attache: string;
  };
}

export interface OptionFiltre {
  /** Identifiant stable de l'option (jamais affiché). */
  cle: string;
  fr: string;
  ar: string;
  /**
   * Mots reconnus dans l'attribut du produit, sa catégorie ou son nom —
   * normalisés (minuscules, sans accents). Un mot simple doit commencer un
   * mot du texte (« son » ne prend pas « maison ») ; un mot composé (espace
   * ou tiret, « animaux-chats ») est cherché tel quel.
   */
  motsCles: string[];
}

export interface FiltreMetier {
  titre: TexteBilingue;
  /**
   * `tailles` : les tailles réelles du produit (`products.sizes`) — Mode.
   * Sinon la clé `product_attributes` lue en priorité (« marque »,
   * « famille_olfactive »…), complétée par la catégorie et le nom.
   */
  source: "tailles" | { attributs: string[] };
  /** Vide pour `tailles` : les options sont les tailles présentes. */
  options: OptionFiltre[];
}

export interface ConfigVitrine {
  id: VitrineId;
  label: TexteBilingue;
  /** Accent du handoff, converti en hex (oklch d'origine en commentaire). */
  accent: string;
  /** color-mix(accent 13 %, blanc). */
  accentDoux: string;
  /** color-mix(accent 6 %, #f6f4f9). */
  fondPage: string;
  /** Libellé du bouton principal de l'en-tête (« اسأل البائع »…). */
  libelleAction: TexteBilingue;
  filtre: FiltreMetier;
  scene: SceneVitrine;
}
