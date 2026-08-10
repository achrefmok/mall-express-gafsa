import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { VendorOrderCard } from "./orders-client";

export const metadata: Metadata = {
  title: "Commandes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VendorOrdersPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, total, created_at, delivery_method, payment_method,
       contact_phone, delivery_address, note,
       buyer:profiles(first_name, last_name),
       items:order_items(id, product_name, product_image, quantity, unit_price)`,
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <TopBar title={t.nav.orders} />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pt-2 pb-4">
        {(orders ?? []).length === 0 ? (
          <EmptyState title={t.orders.empty} />
        ) : (
          orders!.map((order) => <VendorOrderCard key={order.id} order={order} locale={locale} />)
        )}
      </div>
    </>
  );
}
