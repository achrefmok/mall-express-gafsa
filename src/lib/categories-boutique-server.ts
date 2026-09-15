import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries";
import { categoriesPourBoutique } from "@/lib/categories-boutique";

/**
 * Les catégories proposées à une boutique pour ses produits.
 *
 * Le type de la boutique : sa catégorie principale, et ses « catégories
 * vendues » déclarées dans les réglages. La règle elle-même est dans
 * `categories-boutique.ts`, pure et testée.
 */
export async function categoriesProduitPourBoutique(
  shop: { id: string; category_id: string | null },
  categorieActuelle?: string | null,
) {
  const supabase = await createClient();

  const [toutes, { data: vendues }] = await Promise.all([
    getCategories(false),
    supabase.from("shop_categories").select("category_id").eq("shop_id", shop.id),
  ]);

  return categoriesPourBoutique(
    toutes,
    [shop.category_id, ...(vendues ?? []).map((row) => row.category_id)],
    categorieActuelle,
  );
}
