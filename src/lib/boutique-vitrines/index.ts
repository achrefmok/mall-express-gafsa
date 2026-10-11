import { VITRINES } from "./configs";
import type { ConfigVitrine, FiltreMetier, OptionFiltre, VitrineId } from "./types";

export { VITRINES, reglagesScene } from "./configs";
export type { ConfigVitrine, FiltreMetier, OptionFiltre, SceneVitrine, VitrineId } from "./types";

/**
 * Catégorie de la boutique → vitrine. Une catégorie absente n'a pas de
 * vitrine (bijouterie, maison, santé, cafés…) : décision de l'utilisateur,
 * pas de présentoir pour un métier sans maquette.
 *
 * `electronique` et `beaute`, catégories parentes, sont tranchées par les
 * produits réels de la boutique (voir `resolveVitrine`).
 */
const VITRINE_PAR_CATEGORIE: Record<string, VitrineId> = {
  mode: "mode",
  "mode-femme": "mode",
  "mode-homme": "mode",
  "mode-enfant": "mode",
  "mode-accessoires": "mode",
  "mode-chaussures": "mode",
  "electronique-telephones": "telephones",
  "electronique-ordinateurs": "telephones",
  "electronique-audio": "telephones",
  "electronique-accessoires": "telephones",
  informatique: "telephones",
  "electronique-electromenager": "electromenager",
  "beaute-parfums": "parfumerie",
  "beaute-maquillage": "cosmetiques",
  "beaute-soin": "cosmetiques",
  parapharmacie: "parapharmacie",
  "voitures-motos": "moto",
  alimentation: "patisserie",
  animaux: "animalerie",
  "animaux-chiens": "animalerie",
  "animaux-chats": "animalerie",
  "animaux-oiseaux": "animalerie",
  "animaux-poissons": "animalerie",
  "animaux-nourriture": "animalerie",
  "animaux-accessoires": "animalerie",
  sport: "sport",
  "sport-loisirs": "sport",
  location: "location",
  "location-voitures": "location",
  "location-fetes": "location",
  "location-sonorisation": "location",
  "location-camping": "location",
};

/**
 * La vitrine d'une boutique, résolue côté serveur.
 *
 * Pour une catégorie parente, la majorité des produits réels décide : une
 * boutique « Électronique » qui vend surtout des frigos est un showroom
 * d'électroménager, pas un magasin de téléphones ; une boutique « Beauté »
 * qui vend surtout des parfums est une parfumerie, sinon elle garde sa mise
 * en page Beauté (maquillage, soin : pas de maquette).
 */
export function resolveVitrine(
  slugCategorie: string | null | undefined,
  slugsProduits: Array<string | null | undefined> = [],
): ConfigVitrine | null {
  if (!slugCategorie) return null;

  if (slugCategorie === "electronique") {
    const electro = slugsProduits.filter((s) => s === "electronique-electromenager").length;
    return VITRINES[electro * 2 > slugsProduits.filter(Boolean).length && electro > 0 ? "electromenager" : "telephones"];
  }
  if (slugCategorie === "beaute") {
    const parfums = slugsProduits.filter((s) => s === "beaute-parfums").length;
    return parfums > 0 && parfums * 2 > slugsProduits.filter(Boolean).length ? VITRINES.parfumerie : VITRINES.cosmetiques;
  }

  const id = VITRINE_PAR_CATEGORIE[slugCategorie];
  return id ? VITRINES[id] : null;
}

/** Minuscules, sans accents latins ni hamza/tatouil arabes superflus. */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا");
}

/** Les mots d'un texte normalisé, article arabe « ال » retiré en tête. */
function mots(texte: string): string[] {
  return texte
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((m) => (m.length > 3 && m.startsWith("ال") ? m.slice(2) : m));
}

/**
 * Vrai si l'option reconnaît le texte. Un mot-clé simple doit commencer un
 * mot (« son » ne prend pas « maison ») ; un mot-clé composé (espace ou
 * tiret) est cherché tel quel.
 */
export function correspondOption(option: OptionFiltre, texte: string): boolean {
  const t = normaliser(texte);
  if (!t) return false;
  const liste = mots(t);
  return option.motsCles.some((brut) => {
    const k = normaliser(brut);
    if (/[\s-]/.test(k)) return t.includes(k);
    return liste.some((m) => m.startsWith(k));
  });
}

interface ProduitFiltrable {
  name: string;
  sizes?: string[];
  attributs?: Record<string, string>;
  category?: { slug?: string } | null;
}

/**
 * Le texte qu'un filtre lit sur un produit : l'attribut déclaré par le
 * vendeur d'abord ; à défaut, sa catégorie et son nom — des données déjà
 * saisies, jamais une étiquette inventée.
 */
export function texteFiltrable(p: ProduitFiltrable, filtre: FiltreMetier): string {
  if (filtre.source === "tailles") return (p.sizes ?? []).join(" ");
  const attributs = filtre.source.attributs.map((k) => p.attributs?.[k]).filter(Boolean);
  if (attributs.length > 0) return attributs.join(" ");
  return `${p.category?.slug ?? ""} ${p.name}`;
}

/** Vrai si le produit répond à l'option choisie (`null` = « الكل »). */
export function produitCorrespond(p: ProduitFiltrable, filtre: FiltreMetier, cle: string | null): boolean {
  if (!cle) return true;
  if (filtre.source === "tailles") return (p.sizes ?? []).includes(cle);
  const option = filtre.options.find((o) => o.cle === cle);
  return option ? correspondOption(option, texteFiltrable(p, filtre)) : true;
}

/**
 * Les options à afficher : seulement celles qu'au moins un produit porte.
 * Pour les tailles, les tailles réellement présentes, dans l'ordre usuel.
 * Une liste vide masque le filtre entier — jamais une puce qui éteindrait
 * tout le présentoir.
 */
export function optionsPresentes(produits: ProduitFiltrable[], filtre: FiltreMetier): OptionFiltre[] {
  if (filtre.source === "tailles") {
    const ordre = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
    const tailles = [...new Set(produits.flatMap((p) => p.sizes ?? []))];
    tailles.sort((a, b) => {
      const ia = ordre.indexOf(a.toUpperCase());
      const ib = ordre.indexOf(b.toUpperCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b, "fr", { numeric: true });
    });
    return tailles.map((t) => ({ cle: t, fr: t, ar: t, motsCles: [] }));
  }
  return filtre.options.filter((o) => produits.some((p) => correspondOption(o, texteFiltrable(p, filtre))));
}
