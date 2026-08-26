import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatPrice } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Placeholder, Tag } from "@/components/ui/primitives";
import { CartIcon } from "@/components/ui/icons";
import type { OrderStatus } from "@/types/database";
import { OrderTimeline } from "@/components/orders/order-timeline";

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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ nouvelle?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/commandes");

  /*
    Le numéro que la caisse vient de créer, s'il y en a un.

    La confirmation s'affichait auparavant dans le panier, dans un état local
    que le rafraîchissement suivant emportait. Ici elle tient à une adresse :
    elle survit à un rechargement, se partage, et se trouve déjà à l'endroit où
    le client suivra sa livraison.
  */
  const { nouvelle } = await searchParams;

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
        {/*
          La confirmation de la commande qui vient d'être passée.

          `role="status"` et non `role="alert"` : un lecteur d'écran l'annonce
          sans couper ce qu'il est en train de lire. C'est une bonne nouvelle,
          pas une urgence.
        */}
        {nouvelle && (
          <Card
            role="status"
            className="enter-item flex items-center gap-3 border-[var(--color-brand)] p-3 lg:col-span-full"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1rem] font-bold text-[var(--color-brand)]">
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
                {t.cart.placed} · {nouvelle}
              </p>
              <p className="text-[0.6875rem] leading-snug text-[var(--color-muted)]">
                {t.orders.justPlacedBody}
              </p>
            </div>
          </Card>
        )}

        {(orders ?? []).length === 0 ? (
          <EmptyState title={t.orders.empty} body={t.cart.emptyBody} icon={<CartIcon size={20} />} />
        ) : (
          orders!.map((order) => (
            <Card key={order.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={order.shop ? `/boutique/${order.shop.slug}` : "#"}
                    className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]"
                  >
                    {order.shop?.name}
                  </Link>
                  <p className="text-[0.625rem] text-[var(--color-muted)]">
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
                  <p className="min-w-0 flex-1 truncate text-[0.71875rem] text-[var(--color-ink)]">
                    {item.product_name} × {item.quantity}
                  </p>
                  <p className="flex-none text-[0.6875rem] font-semibold text-[var(--color-muted)]">
                    {formatPrice(item.unit_price * item.quantity, locale)}
                  </p>
                </div>
              ))}

              {/*
                Le trajet, et non le seul état courant.

                « À préparer » est juste et ne répond à aucune des questions
                qu'on se pose en attendant : ce qui s'est déjà passé, ce qui
                vient ensuite, si quelqu'un a seulement vu la commande. Une
                étiquette dit un état, une frise dit un trajet — et c'est le
                trajet qu'on attend.
              */}
              <div className="border-t border-[var(--color-hairline)] pt-[10px]">
                <OrderTimeline
                  status={order.status}
                  delivery={order.delivery_method}
                  libelles={{
                    pending: t.orders.step.pending,
                    to_prepare: t.orders.step.to_prepare,
                    ready: t.orders.step.ready,
                    shipped: t.orders.step.shipped,
                    delivered: t.orders.step.delivered,
                    deliveredPickup: t.orders.step.deliveredPickup,
                    cancelled: t.orders.step.cancelled,
                    cancelledNote: t.orders.step.cancelledNote,
                  }}
                />
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-hairline)] pt-2">
                <span className="text-[0.65625rem] text-[var(--color-muted)]">
                  {order.delivery_method === "pickup" ? t.cart.pickup : t.cart.delivery}
                </span>
                <span className="text-[0.8125rem] font-bold text-[var(--color-brand)]">
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
