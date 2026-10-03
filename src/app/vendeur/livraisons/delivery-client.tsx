"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { advanceDeliveryOrder } from "@/app/actions/courier";
import { formatDateTime, formatPrice, fullName } from "@/lib/format";
import { Button, Card, Placeholder } from "@/components/ui/primitives";
import type { AppLocale, OrderStatus } from "@/types/database";

interface DeliveryOrderData {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  contact_phone: string;
  delivery_address: string | null;
  note: string | null;
  shop: { name: string } | null;
  buyer: { first_name: string | null; last_name: string | null } | null;
  items: Array<{
    id: string;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price: number;
  }> | null;
}

/** Carte de commande côté livreur — dérivée de `VendorOrderCard`, mais vue
 * multi-boutiques : une seule action, celle qui fait avancer son propre
 * groupe (« à prendre en charge » ou « en livraison »). */
export function DeliveryOrderCard({ order, locale }: { order: DeliveryOrderData; locale: AppLocale }) {
  const { t } = useI18n();
  const router = useRouter();

  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      // La page n'affiche que des commandes `ready`/`shipped` (voir la
      // requête de /vendeur/livraisons/page.tsx) — `OrderStatus` est plus
      // large côté type, puisque la colonne l'est aussi.
      const result = await advanceDeliveryOrder(order.id, order.status as "ready" | "shipped");
      if (result.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) return null;

  return (
    <Card className="flex flex-none flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
            {fullName(order.buyer) || "—"}
          </p>
          <p className="text-[0.625rem] text-[var(--color-muted)]">
            {order.order_number} · {formatDateTime(order.created_at, locale)}
          </p>
          <p className="text-[0.625rem] font-semibold text-[var(--color-brand)]">
            {t.delivery.fromShop} : {order.shop?.name ?? "—"}
          </p>
        </div>
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

      <div className="flex flex-col gap-1 border-t border-[var(--color-hairline)] pt-2 text-[0.65625rem] text-[var(--color-muted)]">
        {order.delivery_address && <p>{order.delivery_address}</p>}
        {order.note && <p className="italic">« {order.note} »</p>}
        <a href={`tel:${order.contact_phone}`} className="font-semibold text-[var(--color-brand)]">
          {order.contact_phone}
        </a>
      </div>

      {error && (
        <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.875rem] font-bold text-[var(--color-brand)]">
          {formatPrice(order.total, locale)}
        </span>

        <Button size="sm" onClick={accept} disabled={pending}>
          {order.status === "ready" ? t.delivery.takeAction : t.delivery.completeAction}
        </Button>
      </div>
    </Card>
  );
}
