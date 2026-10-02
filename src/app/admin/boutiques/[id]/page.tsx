import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { ShopDetailClient } from "./shop-detail-client";

export const metadata: Metadata = {
  title: "Boutique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Fiche boutique, côté administration : les mêmes champs que le commerçant
 * remplit dans ses propres réglages, plus les chiffres qu'il n'a pas à voir
 * ailleurs sous cette forme (commandes, chiffre d'affaires, signalements).
 *
 * Volontairement pas de fiche financière détaillée (par commande, par mode
 * de paiement…) : la console n'a pas vocation à remplacer la comptabilité du
 * commerçant, seulement à donner à l'administration de quoi juger une
 * boutique d'un coup d'œil.
 */
export default async function AdminShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();

  const [{ data: shop }, categories, { count: productsCount }, { count: openReportsCount }, orders] =
    await Promise.all([
      supabase
        .from("shops")
        .select(
          "id, name, name_ar, slug, status, category_id, address, phone, whatsapp, instagram, facebook_url, mall_level, mall_unit, followers_count, views_count, rating_sum, rating_count, submitted_at, approved_at, created_at",
        )
        .eq("id", id)
        .maybeSingle(),
      getCategories(),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", id),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("target_type", "shop")
        .eq("target_id", id)
        .eq("status", "open"),
      supabase.from("orders").select("total, status, created_at").eq("shop_id", id),
    ]);

  if (!shop) notFound();

  const ordersData = orders.data ?? [];
  const commandesValides = ordersData.filter((o) => o.status !== "cancelled");
  const depuisTrenteJours = Date.now() - 30 * 86_400_000;

  const stats = {
    productsCount: productsCount ?? 0,
    openReportsCount: openReportsCount ?? 0,
    ordersCount: commandesValides.length,
    revenueTotal: commandesValides.reduce((a, o) => a + o.total, 0),
    ordersLast30d: commandesValides.filter((o) => new Date(o.created_at).getTime() >= depuisTrenteJours).length,
    revenueLast30d: commandesValides
      .filter((o) => new Date(o.created_at).getTime() >= depuisTrenteJours)
      .reduce((a, o) => a + o.total, 0),
  };

  return (
    <>
      <TopBar title={shop.name} back="/admin/boutiques" />
      <ShopDetailClient shop={shop} categories={categories} stats={stats} t={t} />
    </>
  );
}
