"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { advanceOrder } from "@/app/actions/vendor";
import { formatDateTime, formatPrice, fullName } from "@/lib/format";
import { Button, Card, Placeholder, Tag } from "@/components/ui/primitives";
import type { AppLocale, OrderStatus } from "@/types/database";

interface OrderData {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  delivery_method: "delivery" | "pickup";
  payment_method: "cod" | "call" | "online";
  contact_phone: string;
  delivery_address: string | null;
  note: string | null;
  buyer: { first_name: string | null; last_name: string | null } | null;
  items: Array<{
    id: string;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price: number;
  }> | null;
}

/**
 * Progression du statut. Le retrait au mall saute l'étape « en livraison » :
 * le client vient chercher, il n'y a pas d'acheminement.
 */
function nextStatus(current: OrderStatus, delivery: "delivery" | "pickup"): OrderStatus | null {
  switch (current) {
    case "pending":
      return "to_prepare";
    case "to_prepare":
      return delivery === "pickup" ? "ready" : "shipped";
    case "ready":
    case "shipped":
      return "delivered";
    default:
      return null;
  }
}

export function VendorOrderCard({ order, locale }: { order: OrderData; locale: AppLocale }) {
  const { t } = useI18n();
  const router = useRouter();

  const [status, setStatus] = useState(order.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const next = nextStatus(status, order.delivery_method);

  function advance(target: OrderStatus) {
    const previous = status;
    setStatus(target);
    setError(null);

    startTransition(async () => {
      const result = await advanceOrder(order.id, target);
      if (result.ok) router.refresh();
      else {
        setStatus(previous);
        setError(result.error);
      }
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-[var(--color-ink)]">
            {fullName(order.buyer) || "—"}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {order.order_number} · {formatDateTime(order.created_at, locale)}
          </p>
        </div>
        <Tag
          tone={
            status === "cancelled" ? "live" : status === "delivered" ? "outline" : "tinted"
          }
        >
          {t.orders.status[status]}
        </Tag>
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

      <div className="flex flex-col gap-1 border-t border-[var(--color-hairline)] pt-2 text-[10.5px] text-[var(--color-muted)]">
        <p>
          {order.delivery_method === "pickup" ? t.cart.pickup : t.cart.delivery} ·{" "}
          {order.payment_method === "cod" ? t.cart.paymentCod : t.cart.paymentCall}
        </p>
        {order.delivery_address && <p>{order.delivery_address}</p>}
        {order.note && <p className="italic">« {order.note} »</p>}
        <a href={`tel:${order.contact_phone}`} className="font-semibold text-[var(--color-brand)]">
          {order.contact_phone}
        </a>
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-[var(--color-brand)]">
          {formatPrice(order.total, locale)}
        </span>

        <div className="flex gap-2">
          {status !== "cancelled" && status !== "delivered" && (
            <Button
              tone="outline"
              size="sm"
              onClick={() => advance("cancelled")}
              disabled={pending}
              className="border-[var(--color-live)] text-[var(--color-live)]"
            >
              {t.common.cancel}
            </Button>
          )}
          {next && (
            <Button size="sm" onClick={() => advance(next)} disabled={pending}>
              {t.orders.status[next]}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
