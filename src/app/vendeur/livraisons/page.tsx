import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIsCourier } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { DeliveryOrderCard } from "./delivery-client";

export const metadata: Metadata = {
  title: "Livraisons",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Réservé au compte désigné comme livreur (SADEN DELIVERY) — voir
 * `is_courier()` côté base. Les commandes des autres boutiques ne sont
 * visibles ici que grâce aux policies RLS `orders_courier_select` /
 * `order_items_courier_select` (20261003003000_livreur_rls.sql) : pas de
 * filtre `shop_id`, à la différence de /vendeur/commandes.
 */
export default async function VendorDeliveriesPage() {
  const isCourier = await getIsCourier();
  if (!isCourier) redirect("/vendeur");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, total, created_at, contact_phone, delivery_address, note,
       shop:shops(name),
       buyer:profiles(first_name, last_name),
       items:order_items(id, product_name, product_image, quantity, unit_price)`,
    )
    .eq("delivery_method", "delivery")
    .in("status", ["ready", "shipped"])
    .order("created_at", { ascending: true })
    .limit(50);

  const aPrendre = (orders ?? []).filter((o) => o.status === "ready");
  const enCours = (orders ?? []).filter((o) => o.status === "shipped");

  return (
    <>
      <TopBar title={t.delivery.title} />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-[0.75rem] font-bold text-[var(--color-ink)]">
            {t.delivery.toTake} ({aPrendre.length})
          </h2>
          {aPrendre.length === 0 ? (
            <EmptyState title={t.delivery.empty} />
          ) : (
            aPrendre.map((order) => <DeliveryOrderCard key={order.id} order={order} locale={locale} />)
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[0.75rem] font-bold text-[var(--color-ink)]">
            {t.delivery.inTransit} ({enCours.length})
          </h2>
          {enCours.length === 0 ? (
            <EmptyState title={t.delivery.empty} />
          ) : (
            enCours.map((order) => <DeliveryOrderCard key={order.id} order={order} locale={locale} />)
          )}
        </section>
      </div>
    </>
  );
}
