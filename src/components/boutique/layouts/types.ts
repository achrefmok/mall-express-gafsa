import type { ProductCardData } from "@/components/cards/product-card";

/**
 * Un produit tel que le lit la page boutique — `ProductCardData` reste le
 * type partagé avec marketplace/accueil/recherche/favoris (volontairement
 * allégé, voir ses propres commentaires) ; les mises en page par métier ont
 * besoin d'un peu plus (la sous-catégorie réelle du produit, ses tailles),
 * toujours des champs déjà saisis par le commerçant, jamais inventés.
 */
export interface ProduitBoutique extends ProductCardData {
  sizes?: string[];
  category?: { hue: number; slug?: string; name_fr?: string; name_ar?: string } | null;
  /** `{ "stockage": "128 Go", "poids_g": "12" }` — voir `product_attributes`. */
  attributs?: Record<string, string>;
  /** Les matières déclarées en variante (`product_variants.material`). */
  materiaux?: string[];
}

export interface PackBoutique {
  id: string;
  name: string;
  name_ar: string | null;
  discount_percent: number;
  cover_image: string | null;
  items: Array<{ id: string; name: string; price: number; images: string[] }>;
}
