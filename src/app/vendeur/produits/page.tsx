import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState, Fab } from "@/components/ui/primitives";
import { DotsIcon } from "@/components/ui/icons";
import { ProductFilters, ProductRow } from "./products-client";

export const metadata: Metadata = {
  title: "Mes produits",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Filter = "all" | "online" | "low-stock" | "drafts";

/** Écran 9 — produits et stock. */
export default async function VendorProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; q?: string }>;
}) {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const params = await searchParams;
  const filter: Filter = (["all", "online", "low-stock", "drafts"] as const).includes(
    params.filtre as Filter,
  )
    ? (params.filtre as Filter)
    : "all";

  const { t, locale } = await getT();
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, name, price, stock, low_stock_threshold, images, is_online, is_draft")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  if (params.q?.trim()) query = query.ilike("name", `%${params.q.trim()}%`);

  switch (filter) {
    case "online":
      query = query.eq("is_online", true).eq("is_draft", false);
      break;
    case "low-stock":
      // PostgREST ne compare pas deux colonnes dans un filtre : on retient le
      // seuil par défaut (3), qui est aussi celui de l'index en base. Le seuil
      // réglable par produit sert à l'affichage « — faible » sur chaque ligne.
      query = query.lte("stock", 3);
      break;
    case "drafts":
      query = query.eq("is_draft", true);
      break;
  }

  const [{ data: products }, counts] = await Promise.all([
    query,
    Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .lte("stock", 3),
    ]),
  ]);

  const [total, low] = counts;

  return (
    <>
      <TopBar
        title={t.vendor.myProducts}
        className="pb-[6px]"
        action={
          <span className="text-[var(--color-ink)]" aria-hidden>
            <DotsIcon size={14} />
          </span>
        }
      />

      <ProductFilters
        active={filter}
        totalCount={total.count ?? 0}
        lowStockCount={low.count ?? 0}
        initialQuery={params.q ?? ""}
      />

      <div className="no-sb flex flex-1 flex-col gap-[10px] overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pt-1 pb-[80px]">
        {(products ?? []).length === 0 ? (
          <EmptyState title={t.common.empty} body={t.vendor.addProductCta} />
        ) : (
          products!.map((product) => (
            <ProductRow key={product.id} product={product} locale={locale} />
          ))
        )}
      </div>

      <Fab href="/vendeur/produits/nouveau">{t.vendor.addProductCta}</Fab>
    </>
  );
}
