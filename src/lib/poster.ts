/**
 * La géométrie d'une affiche produit.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi la mise en page vit ici, et non dans le code de dessin
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une affiche se juge à l'œil, ce qui la rend piégeuse : deux cadres qui se
 * chevauchent de trois pixels, un prix qui déborde de la zone sûre, une grille
 * qui n'est pas centrée — rien de tout cela ne lève d'erreur, rien n'apparaît
 * dans un rendu de test, et le vendeur ne s'en aperçoit qu'après avoir publié.
 *
 * Le calcul est donc séparé du dessin. Ce module ne connaît ni canvas, ni
 * couleur, ni police : il produit des rectangles, et des rectangles se
 * vérifient. Le module de rendu se contente de les remplir.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Les formats retenus
 * ────────────────────────────────────────────────────────────────────────
 *
 * Trois, et pas davantage. À Gafsa, une boutique publie sur Facebook — page ou
 * groupe — et sur les statuts WhatsApp. Ces trois formats couvrent tout, et un
 * quatrième choix ne ferait qu'ajouter une décision à prendre à quelqu'un qui
 * veut simplement annoncer un prix.
 */

export type CleFormat = "story" | "carre" | "paysage";

export interface FormatAffiche {
  cle: CleFormat;
  largeur: number;
  hauteur: number;
}

export const FORMATS: Record<CleFormat, FormatAffiche> = {
  /* Statut WhatsApp et story Facebook. Le format le plus consulté ici. */
  story: { cle: "story", largeur: 1080, hauteur: 1920 },
  /* Publication de page Facebook, et Instagram. */
  carre: { cle: "carre", largeur: 1080, hauteur: 1080 },
  /* Partage de lien et couverture d'événement. */
  paysage: { cle: "paysage", largeur: 1200, hauteur: 630 },
};

export interface Cadre {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Disposition {
  /** Bandeau du haut : nom de la boutique, accroche. */
  entete: Cadre;
  /** Un cadre par produit, dans l'ordre où ils ont été choisis. */
  produits: Cadre[];
  /** Bandeau du bas : téléphone, mention de la place de marché. */
  pied: Cadre;
}

/**
 * Au-delà de six produits, une affiche cesse d'être une affiche.
 *
 * Chaque produit ajouté retire de la place à tous les autres : à huit, les
 * photos font deux centimètres sur un téléphone et plus aucun prix n'est
 * lisible. Mieux vaut deux affiches de quatre qu'une de huit — et la limite se
 * dit à l'écran plutôt que de laisser quelqu'un fabriquer une bouillie.
 */
export const PRODUITS_MAX = 6;

/**
 * La marge, proportionnelle au petit côté.
 *
 * En proportion et non en pixels : une marge de 60 px est confortable sur 1080
 * de large et étouffante sur 630 de haut. Les réseaux rognent par ailleurs les
 * bords des stories sur certains téléphones, d'où une marge qui ne descend
 * jamais sous les 5 %.
 */
function margeDe(format: FormatAffiche): number {
  return Math.round(Math.min(format.largeur, format.hauteur) * 0.062);
}

/**
 * La hauteur d'un bandeau, proportionnelle elle aussi.
 *
 * Le paysage est un cas à part : 630 px de haut ne permettent pas d'accorder
 * un huitième de la surface à un pied de page sans écraser les produits. On y
 * réduit les deux bandeaux, et le nom de la boutique passe en plus petit.
 */
function bandeaux(format: FormatAffiche): { entete: number; pied: number } {
  if (format.cle === "paysage") {
    return { entete: Math.round(format.hauteur * 0.17), pied: Math.round(format.hauteur * 0.13) };
  }
  if (format.cle === "story") {
    return { entete: Math.round(format.hauteur * 0.13), pied: Math.round(format.hauteur * 0.1) };
  }
  return { entete: Math.round(format.hauteur * 0.16), pied: Math.round(format.hauteur * 0.12) };
}

/**
 * Répartir `n` produits dans l'espace disponible.
 *
 * La règle est celle d'un imprimeur, pas celle d'un tableur : on ne divise pas
 * bêtement en `n` parts égales. Un seul produit occupe tout — c'est une
 * affiche, pas une vignette. Trois produits donnent un grand et deux petits,
 * parce qu'une rangée de trois carrés identiques ne dit pas ce qu'on met en
 * avant. Quatre et plus tombent en grille, où l'égalité redevient juste.
 */
function grilleDe(n: number, format: FormatAffiche): { colonnes: number; lignes: number } {
  if (n <= 1) return { colonnes: 1, lignes: 1 };

  if (n === 2) {
    /*
      Deux produits : côte à côte, sauf en story.

      Une story fait 1080 × 1920 : deux colonnes y donnent des photos hautes de
      450 px pour 500 de large, alors que deux rangées en donnent de 700. Le
      format commande la découpe, pas le nombre.
    */
    return format.cle === "story" ? { colonnes: 1, lignes: 2 } : { colonnes: 2, lignes: 1 };
  }

  if (n === 3) return format.cle === "paysage" ? { colonnes: 3, lignes: 1 } : { colonnes: 2, lignes: 2 };
  if (n === 4) return { colonnes: 2, lignes: 2 };
  return { colonnes: format.cle === "paysage" ? 3 : 2, lignes: format.cle === "paysage" ? 2 : 3 };
}

export function disposition(nombre: number, format: FormatAffiche): Disposition {
  const n = Math.max(1, Math.min(PRODUITS_MAX, Math.trunc(nombre)));
  const marge = margeDe(format);
  const { entete: hEntete, pied: hPied } = bandeaux(format);

  const entete: Cadre = {
    x: marge,
    y: marge,
    w: format.largeur - marge * 2,
    h: hEntete - marge,
  };

  const pied: Cadre = {
    x: marge,
    y: format.hauteur - hPied,
    w: format.largeur - marge * 2,
    h: hPied - marge,
  };

  /*
    Un souffle entre les bandeaux et les produits.

    Sans lui, la zone des produits commençait exactement là où finissait
    l'en-tête et s'arrêtait exactement là où commençait le pied. Rien ne se
    chevauchait — le contrôle géométrique passait — mais la pastille du numéro
    de téléphone venait affleurer la dernière photo, et l'affiche donnait
    l'impression d'avoir été assemblée trop serré. C'est le genre d'écart qui ne
    se voit qu'une fois l'image rendue.
  */
  const souffle = Math.round(marge * 0.5);

  /* La bande centrale, seule zone où les produits ont le droit d'exister. */
  const zone: Cadre = {
    x: marge,
    y: hEntete + souffle,
    w: format.largeur - marge * 2,
    h: format.hauteur - hEntete - hPied - souffle * 2,
  };

  const { colonnes, lignes } = grilleDe(n, format);
  /* Gouttière plus serrée que la marge : l'affiche doit respirer sur ses bords
     et rester dense au centre, sinon elle se lit comme quatre affiches. */
  const gouttiere = Math.round(marge * 0.55);

  const cellW = (zone.w - gouttiere * (colonnes - 1)) / colonnes;
  const cellH = (zone.h - gouttiere * (lignes - 1)) / lignes;

  const produits: Cadre[] = [];

  /*
    Trois produits en grille de deux : le premier prend toute la largeur.

    Sans ce cas particulier, la grille laisserait une case vide en bas à droite,
    et une case vide sur une affiche ressemble à une erreur d'impression. Le
    produit mis en avant occupe la rangée entière, les deux autres se partagent
    la seconde — ce qui est aussi la hiérarchie qu'on veut : un produit phare,
    deux compagnons.
  */
  const rangeeEntiere = n === 3 && colonnes === 2;

  for (let i = 0; i < n; i += 1) {
    if (rangeeEntiere && i === 0) {
      produits.push({ x: zone.x, y: zone.y, w: zone.w, h: cellH });
      continue;
    }

    const index = rangeeEntiere ? i - 1 : i;
    const ligne = rangeeEntiere ? 1 : Math.floor(index / colonnes);
    const colonne = rangeeEntiere ? index : index % colonnes;

    produits.push({
      x: Math.round(zone.x + colonne * (cellW + gouttiere)),
      y: Math.round(zone.y + ligne * (cellH + gouttiere)),
      w: Math.round(cellW),
      h: Math.round(cellH),
    });
  }

  /*
    Une dernière rangée incomplète est centrée.

    Cinq produits dans une grille de deux colonnes laissent un trou à droite en
    bas. Décaler le dernier d'une demi-case le remet dans l'axe, et l'affiche
    cesse d'avoir l'air tronquée.
  */
  const reste = rangeeEntiere ? 0 : n % colonnes;
  if (reste !== 0 && n > colonnes) {
    const decalage = Math.round(((colonnes - reste) * (cellW + gouttiere)) / 2);
    for (let i = n - reste; i < n; i += 1) produits[i].x += decalage;
  }

  return { entete, produits, pied };
}

/* ═══════════════════════════════════════════════════════════════════════
   Le prix, et ce qu'on a le droit d'en dire
   ═══════════════════════════════════════════════════════════════════════ */

export interface PrixAffiche {
  /** Le prix à payer. */
  actuel: number;
  /** Le prix barré, seulement s'il est réellement supérieur. */
  barre: number | null;
  /** Pourcentage de remise, entier. `null` quand il n'y a pas de remise. */
  remise: number | null;
}

/**
 * Ce qu'une affiche a le droit d'annoncer.
 *
 * Un « -20 % » est une promesse commerciale, et une promesse fausse se retourne
 * contre la boutique bien plus vite qu'elle ne lui rapporte. La remise n'est
 * donc calculée que si le prix de comparaison est réellement supérieur, et
 * l'arrondi se fait vers le bas : annoncer -19 % pour une remise de 19,6 %
 * déçoit moins que d'annoncer -20 % pour 19,6 %.
 */
export function prixAffiche(prix: number, comparaison: number | null | undefined): PrixAffiche {
  const actuel = Number(prix);

  if (
    comparaison === null ||
    comparaison === undefined ||
    !Number.isFinite(Number(comparaison)) ||
    Number(comparaison) <= actuel
  ) {
    return { actuel, barre: null, remise: null };
  }

  const barre = Number(comparaison);
  const remise = Math.floor(((barre - actuel) / barre) * 100);

  /*
    Une remise inférieure à 1 % n'est pas une remise.

    Elle existe pourtant en base — un prix de comparaison saisi à quelques
    millimes près — et afficher « -0 % » en gros sur une affiche est le genre de
    détail qui décrédibilise tout le reste.
  */
  return remise < 1 ? { actuel, barre: null, remise: null } : { actuel, barre, remise };
}

/* ═══════════════════════════════════════════════════════════════════════
   Les thèmes
   ═══════════════════════════════════════════════════════════════════════ */

export type CleTheme = "nuit" | "sable" | "eclat" | "souk";

export interface Theme {
  cle: CleTheme;
  /** Dégradé de fond, du haut vers le bas. */
  fond: [string, string];
  /** Texte principal sur le fond. */
  encre: string;
  /** Texte secondaire. */
  discret: string;
  /** Fond d'une carte produit. */
  carte: string;
  /** Texte sur une carte produit. */
  encreCarte: string;
  /** Couleur d'accent : pastille de prix, ruban de remise. */
  accent: string;
  /** Texte posé sur l'accent. */
  surAccent: string;
}

/**
 * Quatre ambiances, choisies pour ce qu'elles vendent.
 *
 * Ce ne sont pas quatre variations de la même chose : « nuit » convient à
 * l'électronique et au prêt-à-porter, « sable » à l'alimentaire et à
 * l'artisanat, « souk » aux tissus et aux épices, « éclat » aux soldes. Un
 * vendeur choisit en regardant, pas en lisant — d'où des contrastes très
 * différents d'un thème à l'autre.
 */
export const THEMES: Record<CleTheme, Theme> = {
  nuit: {
    cle: "nuit",
    fond: ["#1b1430", "#0d0a18"],
    encre: "#ffffff",
    discret: "rgba(255,255,255,0.66)",
    carte: "rgba(255,255,255,0.07)",
    encreCarte: "#ffffff",
    accent: "#f0c14b",
    surAccent: "#241a05",
  },
  sable: {
    cle: "sable",
    fond: ["#f7efe2", "#e9dcc6"],
    encre: "#2a2118",
    discret: "rgba(42,33,24,0.62)",
    carte: "#ffffff",
    encreCarte: "#2a2118",
    accent: "#b5502a",
    surAccent: "#ffffff",
  },
  eclat: {
    cle: "eclat",
    fond: ["#6d3bd6", "#c0347f"],
    encre: "#ffffff",
    discret: "rgba(255,255,255,0.72)",
    carte: "rgba(255,255,255,0.12)",
    encreCarte: "#ffffff",
    accent: "#ffe45e",
    surAccent: "#3a2a00",
  },
  souk: {
    cle: "souk",
    fond: ["#7a1420", "#3d0a12"],
    encre: "#fdf3e3",
    discret: "rgba(253,243,227,0.66)",
    carte: "rgba(253,243,227,0.09)",
    encreCarte: "#fdf3e3",
    accent: "#e0a33c",
    surAccent: "#2b1405",
  },
};

/**
 * Un nom de fichier qui se retrouve dans un dossier de téléchargements.
 *
 * Le vendeur en produira des dizaines. « affiche.png », « affiche (3).png » ne
 * lui apprend rien trois jours plus tard ; le nom de la boutique et la date lui
 * disent tout de suite ce qu'il regarde.
 */
export function nomFichier(boutique: string, format: CleFormat, quand = new Date()): string {
  const propre = boutique
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Tout ce qui n'est pas une lettre latine ou un chiffre devient un tiret :
    // les noms arabes et les apostrophes cassent certains gestionnaires de
    // fichiers, et un nom illisible vaut mieux qu'un fichier introuvable.
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const jour = quand.toISOString().slice(0, 10);
  return `${propre || "boutique"}-${format}-${jour}.png`;
}
