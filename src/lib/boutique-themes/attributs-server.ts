import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lecture des données par métier (specs, matière, packs) ajoutées pour
 * l'expérience structurelle par catégorie — `product_attributes`,
 * `product_variants.material`, `product_packs`/`pack_items`.
 *
 * Même tolérance que `black-friday-server.ts` : tant que ces migrations ne
 * sont pas collées dans Supabase, chaque lecture échoue proprement et
 * revient à une Map/liste vide plutôt que de casser la page boutique.
 */
const MIGRATION_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

/** `{ "stockage": "128 Go", "ecran": "6,1\"" }` par produit. */
export async function lireAttributsProduits(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const vide = new Map<string, Record<string, string>>();
  if (productIds.length === 0) return vide;

  const { data, error } = await supabase
    .from("product_attributes")
    .select("product_id, key, value")
    .in("product_id", productIds);

  if (error || !data) {
    if (error && !MIGRATION_ABSENTE.includes(error.code)) console.error(error);
    return vide;
  }

  const parProduit = new Map<string, Record<string, string>>();
  for (const row of data) {
    const existant = parProduit.get(row.product_id) ?? {};
    existant[row.key] = row.value;
    parProduit.set(row.product_id, existant);
  }
  return parProduit;
}

/** Les matières déclarées en variante (`"Or 18 ct"`, `"Argent 925"`…) par produit. */
export async function lireMatieresProduits(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const vide = new Map<string, string[]>();
  if (productIds.length === 0) return vide;

  const { data, error } = await supabase
    .from("product_variants")
    .select("product_id, material")
    .in("product_id", productIds)
    .not("material", "is", null);

  if (error || !data) {
    if (error && !MIGRATION_ABSENTE.includes(error.code)) console.error(error);
    return vide;
  }

  const parProduit = new Map<string, string[]>();
  for (const row of data) {
    if (!row.material) continue;
    const existant = parProduit.get(row.product_id) ?? [];
    if (!existant.includes(row.material)) existant.push(row.material);
    parProduit.set(row.product_id, existant);
  }
  return parProduit;
}

export interface PackBoutique {
  id: string;
  name: string;
  name_ar: string | null;
  discount_percent: number;
  cover_image: string | null;
  items: Array<{ id: string; name: string; price: number; images: string[] }>;
}

/** Les packs en ligne d'une boutique, chacun avec ses produits réels. */
export async function lirePacksBoutique(supabase: SupabaseClient, shopId: string): Promise<PackBoutique[]> {
  const { data: packs, error } = await supabase
    .from("product_packs")
    .select("id, name, name_ar, discount_percent, cover_image")
    .eq("shop_id", shopId)
    .eq("is_online", true)
    .order("created_at", { ascending: false });

  if (error || !packs || packs.length === 0) {
    if (error && !MIGRATION_ABSENTE.includes(error.code)) console.error(error);
    return [];
  }

  const { data: items, error: erreurItems } = await supabase
    .from("pack_items")
    .select("pack_id, sort_order, product:products(id, name, price, images)")
    .in(
      "pack_id",
      packs.map((p) => p.id),
    )
    .order("sort_order");

  if (erreurItems) console.error(erreurItems);

  return packs.map((pack) => ({
    ...pack,
    items: (items ?? [])
      .filter((row) => row.pack_id === pack.id && row.product)
      .map((row) => row.product as unknown as { id: string; name: string; price: number; images: string[] }),
  }));
}
