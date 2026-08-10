import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatPrice } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Placeholder, Tag } from "@/components/ui/primitives";
import type { OrderStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Mes commandes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Statuts « en cours » en violet, terminés en neutre, annulé en rouge. */
function statusTone(status: OrderStatus): "tinted" | "outline" | "live" {
  if (status === "cancelled") return "live";
  if (status === "delivered") return "outline";
  return "tinted";
}

export default async function OrdersPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/commandes");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, total, created_at, delivery_method,
       shop:shops(name, slug),
       items:order_items(id, product_name, product_image, quantity, unit_price)`,
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <>
      <TopBar title={t.orders.title} back="/profil" />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-2 lg:content-start px-4 pt-2 pb-4">
        {(orders ?? []).length === 0 ? (
          <EmptyState title={t.orders.empty} body={t.cart.emptyBody} />
        ) : (
          orders!.map((order) => (
            <Card key={order.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={order.shop ? `/boutique/${order.shop.slug}` : "#"}
                    className="truncate text-[12px] font-bold text-[var(--color-ink)]"
                  >
                    {order.shop?.name}
                  </Link>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {order.order_number} · {formatDateTime(order.created_at, locale)}
                  </p>
                </div>
                <Tag tone={statusTone(order.status)}>{t.orders.status[order.status]}</Tag>
              </div>

              {order.items?.map((item) => (
                <div key={item.id} className="flex items-center gap-[10px]">
                  {item.product_image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniature fixe 34px
                    <img
                      src={item.product_image}
                      alt=""
                      className="h-[34px] w-[34px] flex-none rounded-[14px] object-cover"
                    />
                  ) : (
                    <Placeholder className="h-[34px] w-[34px] flex-none" rounded="thumb" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--color-ink)]">
                    {item.product_name} × {item.quantity}
                  </p>
                  <p className="flex-none text-[11px] font-semibold text-[var(--color-muted)]">
                    {formatPrice(item.unit_price * item.quantity, locale)}
                  </p>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-[var(--color-hairline)] pt-2">
                <span className="text-[10.5px] text-[var(--color-muted)]">
                  {order.delivery_method === "pickup" ? t.cart.pickup : t.cart.delivery}
                </span>
                <span className="text-[13px] font-bold text-[var(--color-brand)]">
                  {formatPrice(order.total, locale)}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
