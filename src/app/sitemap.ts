import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { createStaticClient } from "@/lib/supabase/server";
import { lienProduit } from "@/lib/product-url";

const base = siteUrl();

/**
 * Le plan de site ne liste que les pages publiques et durables : les espaces
 * vendeur/admin, le panier et les directs (éphémères) en sont exclus.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/accueil`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/marketplace`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/free-shop`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/services`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/lives`, changeFrequency: "hourly", priority: 0.6 },
    { url: `${base}/inscription`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/suppression-donnees`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const supabase = createStaticClient();

    const [shops, products] = await Promise.all([
      supabase
        .from("shops")
        .select("slug, updated_at")
        .eq("status", "approved")
        .order("followers_count", { ascending: false })
        .limit(1000),

      supabase
        .from("products")
        .select("id, updated_at, shops!inner(status)")
        .eq("is_online", true)
        .eq("is_draft", false)
        .eq("shops.status", "approved")
        .order("updated_at", { ascending: false })
        .limit(4000),
    ]);

    return [
      ...staticRoutes,
      ...(shops.data ?? []).map((shop) => ({
        url: `${base}/boutique/${shop.slug}`,
        lastModified: new Date(shop.updated_at),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...(products.data ?? []).map((product) => ({
        url: `${base}${lienProduit(product)}`,
        lastModified: new Date(product.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // Base injoignable au moment du build : mieux vaut un plan de site
    // réduit qu'un build en échec.
    return staticRoutes;
  }
}
