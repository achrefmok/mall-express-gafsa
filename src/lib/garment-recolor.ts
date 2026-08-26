import sharp from "sharp";
/* sharp 0.35 n'expose plus ses types comme espace de noms sur l'export par
   défaut : ils s'importent nommément. */
import type { Sharp, OutputInfo } from "sharp";

/**
 * Refaire la photo d'un vêtement dans une autre couleur — le vêtement seul.
 *
 * **Ce que produit ce module est un fichier image, pas un filtre.** La version
 * précédente faisait tourner la roue chromatique de la photo entière, en CSS
 * puis avec `sharp` : le pull changeait de couleur, mais le visage, les mains et
 * le décor aussi. Une teinte ne sait pas ce qu'elle traverse.
 *
 * Tout tient donc au **masque** : quels pixels a-t-on le droit de toucher. Il se
 * construit en quatre temps, en retirant ce qui n'est pas le vêtement, puis en
 * n'en gardant que le tissu.
 *
 *   1. **Le fond** — propagation depuis les bords, chaque pixel comparé à la
 *      couleur médiane du cadre et non à son voisin. Comparée au voisin, la
 *      propagation remontait n'importe quel dégradé et avalait toute l'image.
 *      La tolérance se déduit de la variation du fond lui-même : serrée sur un
 *      fond de studio, plus large sur un fond bruité, jamais au point
 *      d'engloutir un vêtement clair.
 *   2. **La peau et la tête** — cône chromatique croisé au repère YCbCr pour la
 *      peau ; pour les cheveux, la boîte de la tache de peau la plus haute et
 *      la plus compacte, étendue vers le haut. La protection est ensuite
 *      dilatée et traitée **par zones**, jamais pixel par pixel : une fibre
 *      beige de jersey chiné tombe dans le cône de la peau, et se faisait
 *      protéger comme un doigt.
 *   3. **La plus grande région** de ce qui reste : le vêtement.
 *   4. **Le tissu**, par propagation à l'intérieur de cette région, depuis les
 *      pixels les plus proches de sa couleur médiane. Chaque pas doit être
 *      minuscule : un dégradé d'éclairage se franchit ainsi de proche en
 *      proche, tandis qu'un logo ou une bande contrastée présentent une marche
 *      franche qui arrête la propagation. C'est ce qui conserve les motifs sans
 *      avoir à les décrire.
 *
 * La décision se prend sur une copie floutée — sans quoi le mélange de fibres
 * d'un jersey chiné ferait trancher sur du bruit et ressortir le vêtement
 * moucheté. La couleur, elle, se pose sur les pixels nets : le grain du tissu
 * survit intact.
 *
 * La clarté est remise en gamme plutôt que translatée : la médiane rejoint
 * exactement celle de la couleur demandée, le noir reste noir et le blanc reste
 * blanc. Les plis, les ombres et le volume du vêtement survivent.
 *
 * **Rien n'est publié sans preuve.** À la sortie, on relit les zones protégées
 * de l'image d'origine et l'on vérifie qu'elles sont inchangées, au pixel près.
 * Si l'une d'elles a bougé, l'image est jetée. Le masque est une heuristique ;
 * cette vérification, elle, n'en est pas une.
 *
 * **Ce que le module ne sait pas faire, et qu'il refuse plutôt que d'approcher :**
 * une ombre chaude sur un tissu clair est colorimétriquement de la peau, et
 * reste donc protégée — sur une photo très contrastée, une partie du vêtement
 * peut ne pas être recolorée. Quand la propagation ne couvre pas quatre
 * cinquièmes de la région, on renonce : un article recoloré à moitié vaut moins
 * qu'un « coloris sans photo » assumé.
 */

/* ─── Réglages ─────────────────────────────────────────────────────────── */

/**
 * Largeur d'analyse. Le masque se calcule petit, s'applique en pleine taille.
 *
 * À trois cent quatre-vingts pixels, chaque cellule d'analyse valait six pixels
 * de l'image finale : la frontière du vêtement sortait en marches d'escalier
 * visibles à l'œil nu. Six cent quarante ramène la marche sous les quatre
 * pixels, que l'adoucissement suffit à effacer, pour un coût d'analyse qui reste
 * inférieur à la demi-seconde.
 */
const ANALYSE = 640;

/** Part minimale et maximale de l'image qu'un vêtement plausible occupe. */
const PART_MIN = 0.02;
const PART_MAX = 0.82;

/** Bornes de l'écart admis avec la couleur de fond, somme des trois canaux. */
const FOND_MIN = 24;
const FOND_MAX = 78;

export type RecolorReason =
  | "image-illisible"
  | "vetement-introuvable"
  | "tissu-heterogene"
  | "couleur-illisible"
  | "sujet-protege";

export type RecolorResult =
  | { ok: true; data: Buffer; part: number }
  | { ok: false; reason: RecolorReason };

/** Le résultat avant encodage : des pixels bruts, et de quoi les relire. */
export type RecolorRawResult =
  | { ok: true; data: Buffer; width: number; height: number; channels: number; part: number }
  | { ok: false; reason: RecolorReason };

/* ─── Conversions ──────────────────────────────────────────────────────── */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return [0, 0, l];

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const canal = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  return [
    Math.round(canal(h + 1 / 3) * 255),
    Math.round(canal(h) * 255),
    Math.round(canal(h - 1 / 3) * 255),
  ];
}

/**
 * Un pixel de peau — et le soin mis à ne pas confondre un bras avec un maillot.
 *
 * Deux repères qui doivent tomber d'accord au moins une fois : la règle
 * chromatique classique (rouge dominant, écart franc entre canaux) et le cône
 * YCbCr, qui décrit la peau bien mieux que le RGB parce qu'il sépare la
 * luminosité de la couleur.
 *
 * Le garde-fou est la saturation : la peau, même très foncée ou très claire, ne
 * dépasse pas les sept dixièmes. Un rouge vif de vêtement, si. Sans cette borne,
 * la règle chromatique classait tous les tissus rouges comme de la peau — et
 * l'on protégeait le tee-shirt qu'on venait recolorer.
 */
export function estPeau(r: number, g: number, b: number): boolean {
  const [, s, l] = rgbToHsl(r, g, b);
  if (s > 0.72 || l < 0.12 || l > 0.95) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const regleRgb =
    r > 95 && g > 40 && b > 20 && max - min > 15 && r - g > 15 && r > b;

  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const regleYcc = cr >= 133 && cr <= 178 && cb >= 77 && cb <= 128;

  return regleRgb || regleYcc;
}

/** La teinte, la saturation et la clarté d'une couleur `#rrggbb`. */
function lireHex(hex: string): [number, number, number] | null {
  const brut = hex.trim().replace(/^#/, "");
  const plein =
    brut.length === 3
      ? brut
          .split("")
          .map((c) => c + c)
          .join("")
      : brut;
  if (!/^[0-9a-fA-F]{6}$/.test(plein)) return null;

  return rgbToHsl(
    parseInt(plein.slice(0, 2), 16),
    parseInt(plein.slice(2, 4), 16),
    parseInt(plein.slice(4, 6), 16),
  );
}

/* ─── Régions ──────────────────────────────────────────────────────────── */

/**
 * Les taches connexes d'un masque, la plus grande d'abord.
 *
 * Parcours en largeur avec une pile explicite : la récursion débordait sur une
 * image de deux mille pixels de large, où une seule région peut compter des
 * centaines de milliers de points.
 */
function regions(masque: Uint8Array, w: number, h: number) {
  const etiquette = new Int32Array(w * h).fill(-1);
  const tailles: number[] = [];
  const boites: Array<[number, number, number, number]> = [];
  const pile = new Int32Array(w * h);

  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || etiquette[depart] !== -1) continue;

    const n = tailles.length;
    let sommet = 0;
    pile[sommet++] = depart;
    etiquette[depart] = n;

    let taille = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;

    while (sommet > 0) {
      const p = pile[--sommet];
      const x = p % w;
      const y = (p - x) / w;

      taille++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;

      if (x > 0 && masque[p - 1] && etiquette[p - 1] === -1) {
        etiquette[p - 1] = n;
        pile[sommet++] = p - 1;
      }
      if (x < w - 1 && masque[p + 1] && etiquette[p + 1] === -1) {
        etiquette[p + 1] = n;
        pile[sommet++] = p + 1;
      }
      if (y > 0 && masque[p - w] && etiquette[p - w] === -1) {
        etiquette[p - w] = n;
        pile[sommet++] = p - w;
      }
      if (y < h - 1 && masque[p + w] && etiquette[p + w] === -1) {
        etiquette[p + w] = n;
        pile[sommet++] = p + w;
      }
    }

    tailles.push(taille);
    boites.push([x0, y0, x1, y1]);
  }

  return { etiquette, tailles, boites };
}

/**
 * Le fond : ce que les bords atteignent sans changer de couleur.
 *
 * **L'écart se mesure avec la couleur de référence du fond, jamais avec le pixel
 * voisin.** De proche en proche, chaque pas restant sous le seuil, la
 * propagation remontait n'importe quel dégradé : sur une photo de studio, elle
 * partait du fond gris clair, franchissait l'ombre du bord, et avalait le
 * vêtement puis le modèle — quatre-vingt-dix-neuf pour cent de l'image
 * déclarés « fond ». Ancrée sur une référence, elle s'arrête au premier écart
 * franc, qui est justement le contour du sujet.
 *
 * La référence est la médiane des pixels de bordure, canal par canal : une
 * moyenne se laisserait déplacer par un coin sombre ou une étiquette.
 */
function trouverFond(px: Buffer, w: number, h: number, canaux: number): Uint8Array {
  const fond = new Uint8Array(w * h);
  const pile = new Int32Array(w * h);
  let sommet = 0;

  const couleur = (i: number) => {
    const o = i * canaux;
    return [px[o], px[o + 1], px[o + 2]] as const;
  };

  const bords: number[] = [];
  for (let x = 0; x < w; x++) {
    bords.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    bords.push(y * w, y * w + w - 1);
  }

  const median = (canal: 0 | 1 | 2) => {
    const valeurs = bords.map((i) => couleur(i)[canal]).sort((a, b) => a - b);
    return valeurs[Math.floor(valeurs.length / 2)];
  };

  const refR = median(0);
  const refG = median(1);
  const refB = median(2);

  /*
    La tolérance se mesure sur le fond lui-même.

    Fixée trop large, elle avalait le vêtement : un tee-shirt gris clair, éclairé
    de face, se retrouve à trente unités d'un fond blanc cassé — et toute la
    moitié éclairée de l'article était déclarée « arrière-plan », donc exclue du
    masque. Le résultat montrait un vêtement recoloré à gauche et intact à
    droite, avec une frontière en plein milieu du torse.

    On regarde donc de combien le fond varie déjà le long du cadre, et l'on
    admet six fois cette variation. Un fond de studio impeccable donne une
    tolérance serrée, qui s'arrête au premier fil de tissu ; un fond dégradé ou
    bruité en obtient une plus large, mais jamais au point d'engloutir un
    vêtement clair.
  */
  const ecarts = bords.map((i) => {
    const [r, g, b] = couleur(i);
    return Math.abs(r - refR) + Math.abs(g - refG) + Math.abs(b - refB);
  });
  ecarts.sort((a, b) => a - b);
  const dispersion = ecarts[Math.floor(ecarts.length * 0.9)];
  const tolerance = Math.min(FOND_MAX, Math.max(FOND_MIN, dispersion * 6));

  const proche = (i: number) => {
    const [r, g, b] = couleur(i);
    return Math.abs(r - refR) + Math.abs(g - refG) + Math.abs(b - refB) <= tolerance;
  };

  const semer = (i: number) => {
    if (fond[i] || !proche(i)) return;
    fond[i] = 1;
    pile[sommet++] = i;
  };

  for (const i of bords) semer(i);

  while (sommet > 0) {
    const p = pile[--sommet];
    const x = p % w;
    const y = (p - x) / w;

    if (x > 0) semer(p - 1);
    if (x < w - 1) semer(p + 1);
    if (y > 0) semer(p - w);
    if (y < h - 1) semer(p + w);
  }

  return fond;
}

/* ─── Recoloration ─────────────────────────────────────────────────────── */

/**
 * Produit une nouvelle image où seul le vêtement porte la couleur demandée.
 *
 * Rend un motif d'échec plutôt qu'une approximation quand le vêtement n'a pas
 * pu être isolé : une image douteuse publiée sur une fiche vaut moins qu'un
 * « coloris sans photo » assumé.
 */
export async function recolorGarment(source: Buffer, cible: string): Promise<RecolorResult> {
  const brut = await recolorGarmentRaw(source, cible);
  if (!brut.ok) return brut;

  const data = await sharp(brut.data, {
    raw: { width: brut.width, height: brut.height, channels: brut.channels as 1 | 2 | 3 | 4 },
  })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();

  return { ok: true, data, part: brut.part };
}

/**
 * La recoloration seule, sans encodage — les pixels tels qu'ils sortent.
 *
 * La séparation n'est pas cosmétique : elle rend le résultat vérifiable. Comparé
 * après compression, le contrôle mêlait ce que la couleur avait changé et ce que
 * le codec avait déplacé — le WebP quantifie par blocs de seize pixels, et un
 * aplat qui passe du noir au rouge fait bouger de vingt unités des pixels situés
 * bien au-delà du vêtement. Sur les pixels bruts, la question redevient nette :
 * ce pixel a-t-il été écrit, oui ou non.
 */
export async function recolorGarmentRaw(
  source: Buffer,
  cible: string,
): Promise<RecolorRawResult> {
  const teinteCible = lireHex(cible);
  if (!teinteCible) return { ok: false, reason: "couleur-illisible" };
  const [hCible, sCible, lCible] = teinteCible;

  let image: Sharp;
  let pleine: { data: Buffer; info: OutputInfo };

  try {
    // `rotate()` sans argument applique l'orientation EXIF : sans lui, une photo
    // prise de côté serait analysée couchée et le masque tomberait à côté.
    image = sharp(source).rotate().toColorspace("srgb");
    pleine = await image.clone().raw().toBuffer({ resolveWithObject: true });
  } catch {
    return { ok: false, reason: "image-illisible" };
  }

  const { width: W, height: H, channels: C } = pleine.info;
  if (!W || !H) return { ok: false, reason: "image-illisible" };

  /* ── 1. Analyse en petit ────────────────────────────────────────────── */

  const petit = await image
    .clone()
    .resize({ width: Math.min(ANALYSE, W), fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = petit.info.width;
  const h = petit.info.height;
  const c = petit.info.channels;
  const px = petit.data;
  const n = w * h;

  const fond = trouverFond(px, w, h, c);
  const peau = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const o = i * c;
    if (estPeau(px[o], px[o + 1], px[o + 2])) peau[i] = 1;
  }

  /* ── 2. La zone de tête, déduite de la plus grande tache de peau ─────── */

  const { tailles: taillesPeau, boites: boitesPeau } = regions(peau, w, h);
  let tete: [number, number, number, number] | null = null;

  {
    /*
      Le visage est la tache de peau **la plus haute**, pas la plus grande.

      Prendre la plus grande donnait, sur une photo de mannequin bras écartés,
      un amas qui va d'une main à l'autre : sa boîte occupait toute la largeur
      et la moitié de la hauteur, et la zone protégée couvrait le tee-shirt
      qu'on venait recolorer. Seule la bande sous le nombril changeait de
      couleur.

      Trois conditions pour qu'une tache soit un visage : une taille plausible,
      une boîte à peu près aussi haute que large — un bras est long et fin —, et
      parmi celles qui restent, la plus haute dans le cadre. Sur un portrait, le
      visage est au-dessus des mains.
    */
    let meilleure = -1;
    let plusHaut = Infinity;

    for (let i = 0; i < taillesPeau.length; i++) {
      if (taillesPeau[i] < n * 0.004) continue;

      const [bx0, by0, bx1, by1] = boitesPeau[i];
      const largeur = bx1 - bx0;
      const hauteur = by1 - by0;

      if (largeur > w * 0.4 || hauteur > h * 0.55) continue;
      if (largeur > hauteur * 2.2) continue;

      if (by0 < plusHaut) {
        plusHaut = by0;
        meilleure = i;
      }
    }

    // Aucune tache ne ressemble à un visage : la photo ne montre probablement
    // personne. Sans tête, il n'y a pas de cheveux à protéger.
    if (meilleure >= 0) {
      const [x0, y0, x1, y1] = boitesPeau[meilleure];
      const largeur = x1 - x0;
      const hauteur = y1 - y0;

      /*
        La zone couvre les cheveux, et s'arrête bien avant le col.

        Elle s'étend largement vers le **haut**, où se trouvent les cheveux, que
        rien dans les pixels ne distingue d'un tissu sombre. Vers le **bas**,
        elle s'arrête au milieu de la tache : celle-ci englobe le cou, qui
        descend jusqu'au col, et la prolonger jusqu'en bas découpait un
        rectangle gris en plein milieu de la poitrine — un défaut bien plus
        visible que le risque qu'il prétendait écarter.
      */
      tete = [
        Math.max(0, Math.round(x0 - largeur * 0.3)),
        Math.max(0, Math.round(y0 - hauteur * 0.9)),
        Math.min(w - 1, Math.round(x1 + largeur * 0.3)),
        Math.round(y0 + hauteur * 0.45),
      ];
    }
  }

  const dansTete = (x: number, y: number) =>
    tete !== null && x >= tete[0] && x <= tete[2] && y >= tete[1] && y <= tete[3];

  /* ── 3. Ce qui reste, et sa plus grande région ───────────────────────── */

  /*
    Ce qu'on s'interdit de toucher, une bonne fois — et **par zones**, non pixel
    par pixel.

    La protection était rejouée en pleine résolution sur chaque pixel pris
    isolément. Or un jersey chiné mêle des fibres beiges à des fibres grises, et
    une fibre beige tombe dans le cône YCbCr de la peau : elle était protégée
    comme si c'était un bras. Le tee-shirt ressortait recoloré d'un côté,
    moucheté au milieu, intact du côté le mieux éclairé — là où les fibres sont
    les plus chaudes.

    La peau est une **région**, pas une couleur : un visage, un avant-bras, une
    main. Elle se décide donc à la résolution d'analyse, où la fibre a disparu
    dans la moyenne, puis se dilate de deux pixels. Cette marge — une quinzaine
    de pixels sur une photo de deux mille — dépasse largement l'adoucissement du
    masque : rien ne peut déborder sur la peau, et une fibre isolée au milieu du
    tissu ne se fait plus passer pour un doigt.
  */
  const protege = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w;
    const y = (i - x) / w;
    if (peau[i] || dansTete(x, y)) protege[i] = 1;
  }

  /*
    Un pixel d'analyse de marge, pas davantage.

    La marge doit couvrir l'adoucissement du masque agrandi, rien de plus. À
    deux, elle rongeait une bande grise tout autour du vêtement — col, bas de
    manche, ourlet —, bien visible sur le résultat.
  */
  const MARGE = 1;
  const protegeDilate = new Uint8Array(protege);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!protege[y * w + x]) continue;
      for (let dy = -MARGE; dy <= MARGE; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -MARGE; dx <= MARGE; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          protegeDilate[ny * w + nx] = 1;
        }
      }
    }
  }

  const candidats = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (fond[i] || protegeDilate[i]) continue;
    candidats[i] = 1;
  }

  const { etiquette, tailles } = regions(candidats, w, h);
  if (tailles.length === 0) return { ok: false, reason: "vetement-introuvable" };

  let vetement = 0;
  for (let i = 1; i < tailles.length; i++) {
    if (tailles[i] > tailles[vetement]) vetement = i;
  }

  const part = tailles[vetement] / n;
  if (part < PART_MIN || part > PART_MAX) {
    return { ok: false, reason: "vetement-introuvable" };
  }

  /* ── 4. Le tissu proprement dit, par propagation dans la région ──────── */

  /*
    Une version floutée, pour décider — jamais pour peindre.

    Un jersey chiné est un mélange de fibres claires et sombres à l'échelle du
    pixel. Décider fibre par fibre sur le pixel nu revenait à trancher sur du
    bruit : une fibre passait, la suivante non, et le vêtement ressortait
    moucheté. Le flou efface la fibre et laisse ce qui compte — la matière, et
    la façon dont la lumière tombe.
  */
  const flouBrut = await sharp(px, { raw: { width: w, height: h, channels: c as 1 | 2 | 3 | 4 } })
    .blur(2)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const flou = flouBrut.data;
  const cf = flouBrut.info.channels;

  /** Clarté et chromaticité d'un pixel de l'image floutée. */
  const teinteDe = (i: number) => {
    const o = i * cf;
    const [hh, ss, ll] = rgbToHsl(flou[o], flou[o + 1], flou[o + 2]);
    return [ll, Math.cos(hh * 2 * Math.PI) * ss, Math.sin(hh * 2 * Math.PI) * ss] as const;
  };

  const clartes: number[] = [];
  const chromaA: number[] = [];
  const chromaB: number[] = [];

  for (let i = 0; i < n; i++) {
    if (etiquette[i] !== vetement) continue;
    const [ll, aa, bb] = teinteDe(i);
    clartes.push(ll);
    // Chromaticité en coordonnées cartésiennes : moyenner des teintes en degrés
    // ferait sortir du vert de deux rouges de part et d'autre de zéro.
    chromaA.push(aa);
    chromaB.push(bb);
  }

  const mediane = (valeurs: number[]) => {
    const tri = [...valeurs].sort((x, y) => x - y);
    return tri[Math.floor(tri.length / 2)];
  };

  const clarteDominante = mediane(clartes);
  const aDominant = mediane(chromaA);
  const bDominant = mediane(chromaB);

  /*
    **Le tissu se propage, il ne se seuille pas.**

    Comparer chaque pixel à la couleur médiane du vêtement suppose un aplat. Un
    tee-shirt éclairé de biais — le cas le plus banal en boutique — s'étale d'un
    bord à l'autre en clarté : le seuil coupait au milieu de cet étalement, et la
    moitié du vêtement restait dans sa couleur d'origine, avec une frontière
    organique en plein milieu du torse.

    On part donc du cœur du tissu — les pixels les plus proches de sa médiane —
    et l'on avance de voisin en voisin tant que **l'écart local** reste faible.
    Un dégradé d'éclairage se franchit ainsi de proche en proche, puisque chaque
    pas est minuscule ; un logo, une bande contrastée ou une fermeture éclair
    présentent au contraire une marche franche, et la propagation s'y arrête.
    C'est ce qui conserve les motifs sans avoir à les décrire.

    La région du vêtement sert de clôture : la propagation ne peut pas en sortir,
    et ne risque donc pas de gagner le fond ni la peau par un dégradé doux — le
    piège exact qui avait fait avaler toute l'image à la détection du fond.
  */
  const tissu = new Uint8Array(n);
  const file = new Int32Array(n);
  let sommet = 0;

  const PAS_CLARTE = 0.05;
  const PAS_CHROMA = 0.06;
  const NOYAU_CLARTE = 0.06;
  const NOYAU_CHROMA = 0.06;

  for (let i = 0; i < n; i++) {
    if (etiquette[i] !== vetement) continue;
    const [ll, aa, bb] = teinteDe(i);
    if (Math.abs(ll - clarteDominante) > NOYAU_CLARTE) continue;
    if (Math.hypot(aa - aDominant, bb - bDominant) > NOYAU_CHROMA) continue;

    tissu[i] = 1;
    file[sommet++] = i;
  }

  // Aucun noyau : la région est trop hétérogène pour qu'on sache ce qu'est le
  // tissu. Mieux vaut renoncer que recolorer au hasard.
  if (sommet === 0) return { ok: false, reason: "vetement-introuvable" };

  while (sommet > 0) {
    const p = file[--sommet];
    const [lp, ap, bp] = teinteDe(p);
    const x = p % w;
    const y = (p - x) / w;

    const voisin = (q: number) => {
      if (tissu[q] || etiquette[q] !== vetement) return;
      const [lq, aq, bq] = teinteDe(q);
      if (Math.abs(lq - lp) > PAS_CLARTE) return;
      if (Math.hypot(aq - ap, bq - bp) > PAS_CHROMA) return;
      tissu[q] = 1;
      file[sommet++] = q;
    };

    if (x > 0) voisin(p - 1);
    if (x < w - 1) voisin(p + 1);
    if (y > 0) voisin(p - w);
    if (y < h - 1) voisin(p + w);
  }

  let aire = 0;
  for (let i = 0; i < n; i++) aire += tissu[i];
  if (aire < n * PART_MIN) return { ok: false, reason: "vetement-introuvable" };

  /*
    **Tout le vêtement, ou rien.**

    C'est le garde-fou qui décide de la qualité du résultat, et il vaut mieux
    l'expliquer que le découvrir.

    Quand la propagation ne parvient pas à couvrir la région — parce que la
    lumière fait un saut, parce qu'une ombre coupe le torse en deux, parce que
    la matière change au milieu — elle s'arrête en chemin. On obtenait alors un
    tee-shirt rouge sur la moitié gauche et gris sur la droite, avec une
    frontière en plein milieu de la poitrine. C'est pire que tout : le client
    voit un article défectueux là où il aurait accepté « pas de photo pour ce
    coloris ».

    En dessous de quatre cinquièmes de la région couverts, on refuse donc. Un
    vêtement à très grand motif est refusé lui aussi, à tort — mais le vendeur a
    toujours le recours de déposer une vraie photo, alors qu'il n'a aucun recours
    contre une image à moitié recolorée déjà en ligne.
  */
  if (aire < tailles[vetement] * 0.8) {
    return { ok: false, reason: "tissu-heterogene" };
  }

  /*
    La clarté est **remise en gamme**, non translatée.

    Le tissu doit garder ses plis, mais son niveau moyen doit rejoindre celui de
    la couleur demandée — sans quoi un tee-shirt noir teinté en rouge resterait
    presque noir. Ajouter un écart constant à chaque pixel le faisait bien, et
    poussait du même coup les ombres profondes vers le milieu de l'échelle : le
    creux sous le bras ressortait en aplat rose, sans matière.

    Une courbe en puissance déplace la médiane exactement là où il faut tout en
    laissant le noir noir et le blanc blanc. Les ombres restent des ombres, les
    reflets restent des reflets, et le volume du vêtement survit.
  */
  const gamma =
    clarteDominante > 0.02 && clarteDominante < 0.98 && lCible > 0.02 && lCible < 0.98
      ? Math.log(lCible) / Math.log(clarteDominante)
      : 1;

  /* ── 5. Le masque, agrandi en douceur ────────────────────────────────── */

  const masquePetit = Buffer.alloc(n);
  for (let i = 0; i < n; i++) masquePetit[i] = tissu[i] ? 255 : 0;

  /*
    Le nombre de canaux est relu, jamais supposé.

    `blur()` fait repasser l'image par l'espace sRGB : un masque à un canal en
    ressort à trois. Le lire au pas de un octet revenait à échantillonner le
    masque au tiers de sa largeur — il valait zéro partout où le vêtement se
    trouvait, et la recoloration ne touchait pas un seul pixel sans rien
    signaler. Le flou est là pour adoucir la frontière ; il ne doit pas décider
    de la façon dont on lit le tableau.
  */
  const masqueBrut = await sharp(masquePetit, { raw: { width: w, height: h, channels: 1 } })
    .resize({ width: W, height: H, fit: "fill" })
    .blur(1.2)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const masque = masqueBrut.data;
  const pasMasque = masqueBrut.info.channels;

  /* ── 6. L'application, pixel par pixel, en pleine taille ─────────────── */

  const sortie = Buffer.from(pleine.data);
  const echelleX = w / W;
  const echelleY = h / H;
  let touches = 0;

  for (let y = 0; y < H; y++) {
    const yPetit = Math.min(h - 1, Math.floor(y * echelleY));

    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const alpha = Math.min(1, masque[i * pasMasque] / 255);
      if (alpha < 0.04) continue;

      const o = i * C;
      const r = pleine.data[o];
      const g = pleine.data[o + 1];
      const b = pleine.data[o + 2];

      /*
        La protection rejouée, mais sur la carte de zones.

        Le masque a été calculé petit puis agrandi : ses bords débordent
        forcément d'un pixel ou deux. On revérifie donc ici — non pas la couleur
        du pixel, qui confondrait une fibre chaude avec un doigt, mais la zone à
        laquelle il appartient. La marge de dilatation rend la garantie
        indépendante de l'agrandissement.
      */
      if (protegeDilate[yPetit * w + Math.min(w - 1, Math.floor(x * echelleX))]) continue;

      // La couleur se pose sur le pixel **net** : c'est là que vivent le grain
      // du tissu, les fibres et les plis fins, que le flou a effacés.
      const [, ss, ll] = rgbToHsl(r, g, b);
      const l2 = Math.min(0.98, Math.max(0.02, Math.pow(ll, gamma)));

      /*
        La saturation suit la clarté : un pli très clair ou très sombre porte
        moins de couleur qu'un aplat, sur un vrai vêtement comme ici. Poser une
        saturation constante donnait un aplat de peinture, pas du tissu.
      */
      const s2 = Math.max(
        ss * 0.25,
        Math.min(1, sCible * Math.sqrt(Math.max(0, 1 - Math.abs(2 * l2 - 1)))),
      );

      const [r2, g2, b2] = hslToRgb(hCible, s2, l2);

      sortie[o] = Math.round(r + (r2 - r) * alpha);
      sortie[o + 1] = Math.round(g + (g2 - g) * alpha);
      sortie[o + 2] = Math.round(b + (b2 - b) * alpha);
      touches++;
    }
  }

  if (touches < W * H * PART_MIN * 0.5) {
    return { ok: false, reason: "vetement-introuvable" };
  }

  /* ── 7. La preuve ────────────────────────────────────────────────────── */

  const verdict = verifierSujet(pleine.data, sortie, W, H, C, protegeDilate, w, h);
  if (!verdict) return { ok: false, reason: "sujet-protege" };

  return { ok: true, data: sortie, width: W, height: H, channels: C, part };
}

/**
 * La vérification qui autorise la publication : aucun pixel de peau n'a bougé.
 *
 * Le masque est une suite d'heuristiques, et une heuristique se trompe. Celle-ci
 * ne se trompe pas : elle relit la photo d'origine, retrouve chaque pixel que la
 * règle de peau désigne, et compare. Un seul écart et l'image est refusée.
 *
 * C'est la différence entre « on a essayé de ne pas toucher au visage » et « le
 * visage n'a pas été touché ».
 */
function verifierSujet(
  avant: Buffer,
  apres: Buffer,
  W: number,
  H: number,
  C: number,
  protege: Uint8Array,
  w: number,
  h: number,
): boolean {
  const echelleX = w / W;
  const echelleY = h / H;

  for (let y = 0; y < H; y++) {
    const yPetit = Math.min(h - 1, Math.floor(y * echelleY));

    for (let x = 0; x < W; x++) {
      if (!protege[yPetit * w + Math.min(w - 1, Math.floor(x * echelleX))]) continue;

      const o = (y * W + x) * C;
      if (
        apres[o] !== avant[o] ||
        apres[o + 1] !== avant[o + 1] ||
        apres[o + 2] !== avant[o + 2]
      ) {
        return false;
      }
    }
  }

  return true;
}
