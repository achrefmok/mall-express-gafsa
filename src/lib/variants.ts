import type { VariantImage, VariantImages } from "@/types/database";

/**
 * Ce que la fiche montre pour chaque coloris.
 *
 * **Une règle, et tout en découle : un coloris se montre par une photo qui le
 * montre, ou pas du tout.**
 *
 * L'application a d'abord essayé de fabriquer les coloris manquants en faisant
 * tourner la roue chromatique de la photo d'origine — côté serveur avec
 * `sharp`, puis en direct avec un filtre CSS. Le résultat était juste sur un
 * article détouré sur fond blanc, et désastreux partout ailleurs : sur une
 * photo de studio, la rotation ne touchait pas le pull gris mais virait le
 * visage, les mains et le décor au vert. Aucun traitement pixel ne sait
 * distinguer le tissu de la peau, et une photo de catalogue en contient
 * presque toujours.
 *
 * D'où ce module, plus court que celui qu'il remplace : il choisit des images,
 * il n'en fabrique aucune.
 */

/**
 * Ce que vaut ce qu'on montre — la seule chose que le client ne peut pas voir
 * par lui-même, et donc la seule qu'il faut lui dire.
 *
 *   · `photo` — le vendeur a photographié l'article dans ce coloris, ou c'est
 *     le coloris que montrent les photos du produit.
 *   · `generated` — l'image a été fabriquée à partir d'une autre photo, du
 *     temps où l'application le faisait. La couleur approche ; la matière et
 *     les finitions restent celles du modèle photographié, et la fiche le dit.
 *   · `unavailable` — aucune image ne montre ce coloris. Il reste en vente et
 *     reste choisissable ; l'étiquette dit simplement qu'on ne peut pas le
 *     montrer, ce qui vaut mieux que de faire passer une autre couleur pour lui.
 */
export type VariantFidelity = "photo" | "generated" | "unavailable";

export interface VariantView {
  /** La couleur telle qu'elle figure dans `products.colors`. */
  color: string;
  /** Les photos de ce coloris, la principale en tête. */
  srcs: string[];
  /** Ce que valent ces pixels pour ce coloris. */
  fidelity: VariantFidelity;
}

/**
 * Un coloris, ses photos, et ce qu'elles valent.
 *
 * L'ordre des photos ne change pas d'un coloris à l'autre : les vues propres au
 * coloris d'abord, dans l'ordre où le vendeur les a déposées, puis les vues
 * générales du produit. Quelqu'un qui compare le dos de deux coloris retrouve
 * ainsi le dos au même rang — et les vues générales, qui valent pour toutes les
 * couleurs, ne disparaissent jamais.
 */
export function variantView(
  colors: string[],
  images: string[],
  variantImages: VariantImages | null | undefined,
  selected: string | null,
): VariantView {
  const current = variantImages ?? {};
  const color = selected ?? colors[0] ?? "";
  const entry: VariantImage | undefined = current[color];

  /*
    1. Les images du coloris — et **elles seules**.

    Les photos générales du produit étaient auparavant ajoutées à la suite, pour
    ne rien perdre : l'étiquette, la vue portée, le dos. C'était une erreur, et
    elle se voyait. Sur un article dont seul le noir est photographié, choisir
    « jaune » affichait bien la vignette jaune en tête — mais la bande de
    miniatures juste dessous montrait toujours le pull gris, et un glissement
    ramenait le gris sous le nom « Jaune ». La galerie mélangeait deux coloris
    dans la même liste.

    Une galerie de coloris ne contient donc que ce coloris. Le vendeur qui tient
    à montrer l'étiquette sur toutes les déclinaisons dépose la vue dans chacune.
  */
  if (entry?.url) {
    const vues = entry.images?.length ? entry.images : [entry.url];
    return { color, srcs: vues, fidelity: entry.generated ? "generated" : "photo" };
  }

  /*
    2. Le premier coloris déclaré est celui des photos du produit.

    C'est une hypothèse, mais c'est celle de tous les vendeurs : on photographie
    l'article qu'on a en main, puis on déclare les autres coloris. Les photos du
    produit lui reviennent donc de droit, sans étiquette.
  */
  if (!colors.length || color === colors[0]) {
    return { color, srcs: images, fidelity: "photo" };
  }

  /*
    3. Rien — et surtout pas les photos du produit.

    Renvoyer l'image principale ici était le vrai défaut : le client touchait
    « jaune », le nom changeait, la pastille changeait, et l'écran continuait de
    montrer le pull gris. Une étiquette avouait bien « coloris sans photo », mais
    personne ne lit une étiquette quand l'image, elle, affirme le contraire.

    Une liste vide oblige l'affichage à dire franchement qu'il n'a rien à
    montrer, au lieu de faire passer une couleur pour une autre.
  */
  return { color, srcs: [], fidelity: "unavailable" };
}

/**
 * Tous les coloris de l'article, dans l'ordre, avec ce qu'on sait montrer de
 * chacun.
 *
 * **Tous**, y compris ceux sans photo. Sur la fiche, le carrousel n'est pas
 * qu'une vitrine : c'est aussi la façon de choisir ce qu'on commande. En
 * écarter un coloris le rendrait invendable alors qu'il est en rayon. Celui-là
 * garde les photos du produit et porte une étiquette qui dit qu'aucune image ne
 * le montre — c'est moins bien qu'une photo, c'est infiniment mieux qu'une
 * couleur qu'on ne peut pas acheter.
 */
export function variantCarousel(
  colors: string[],
  images: string[],
  variantImages: VariantImages | null | undefined,
): VariantView[] {
  if (images.length === 0) return [];

  /*
    Aucun filtre : un coloris sans image reste dans le défilé.

    Il l'était autrefois, du temps où « sans image » signifiait encore « les
    photos du produit » et où la liste n'était donc jamais vide. Maintenant
    qu'elle peut l'être, le réflexe serait de l'écarter — et ce serait rendre
    invendable un coloris qui est en rayon. Il garde sa place ; c'est l'affichage
    qui dira qu'aucune photo ne le montre.
  */
  return colors.map((color) => variantView(colors, images, variantImages, color));
}

export interface GenerationPlan {
  /** Coloris à produire. */
  color: string;
  /** Coloris dont part la recoloration — celui de la photo de référence. */
  from: string;
  /** Photo de référence. */
  sourceUrl: string;
}

/**
 * Ce qu'il reste à fabriquer, et à partir de quelle photo.
 *
 * La référence est le premier coloris déclaré : c'est celui que montrent les
 * photos du produit, et c'est de lui que tout se déduit. S'il a reçu ses propres
 * photos, ce sont elles qui servent — un vendeur qui remplace la photo générale
 * par un cliché mieux détouré améliore du même coup tous les coloris dérivés.
 *
 * Sont écartés : le coloris de référence lui-même, ceux qui ont une vraie photo,
 * et ceux dont l'image fabriquée est encore valable — c'est-à-dire produite
 * depuis la photo de référence actuelle. Changer la photo du produit périme donc
 * les dérivées, et elles seront refaites au prochain passage.
 *
 * On ne repart jamais d'une image déjà fabriquée : les écarts s'additionneraient
 * de proche en proche.
 */
export function planGeneration(
  colors: string[],
  images: string[],
  variantImages: VariantImages | null | undefined,
): GenerationPlan[] {
  if (colors.length < 2 || images.length === 0) return [];

  const current = variantImages ?? {};
  const reference = colors[0];
  const entree = current[reference];

  const sourceUrl = entree && !entree.generated && entree.url ? entree.url : images[0];
  if (!sourceUrl) return [];

  return colors.flatMap((color) => {
    if (color === reference) return [];

    const existante = current[color];
    if (existante && !existante.generated) return [];
    if (existante?.generated && existante.from === sourceUrl) return [];

    return [{ color, from: reference, sourceUrl }];
  });
}

/**
 * Les coloris dont l'image change vraiment — pour les listes, où une pastille
 * qui ne change rien serait un bouton mort.
 *
 * Une vignette de cent trente pixels n'a la place ni d'une étiquette ni d'une
 * explication : une pastille y promet un changement d'image, ou n'y figure pas.
 * La fiche produit, elle, les montre tous, parce qu'elle a la place de dire
 * pourquoi.
 */
export function displayableColors(
  colors: string[],
  images: string[],
  variantImages: VariantImages | null | undefined,
): string[] {
  return variantCarousel(colors, images, variantImages)
    .filter((vue) => vue.fidelity !== "unavailable")
    .map((vue) => vue.color);
}
