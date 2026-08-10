"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { placeOrder, removeFromCart, setCartQuantity } from "@/app/actions/cart";
import { cx, formatPrice } from "@/lib/format";
import { Button, Card, Divider, Placeholder } from "@/components/ui/primitives";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import type { AppLocale, DeliveryMethod, PaymentMethod } from "@/types/database";

interface Item {
  id: string;
  quantity: number;
  color: string | null;
  size: string | null;
  product: { id: string; name: string; price: number; images: string[]; stock: number };
}

/**
 * Un bloc de panier par boutique, avec son propre passage en caisse.
 * Le total affiché ici est indicatif : le montant qui fait foi est calculé
 * par `place_order` côté base.
 */
export function CartShopGroup({
  shop,
  items,
  locale,
  defaultPhone,
}: {
  shop: { id: string; name: string; slug: string; delivers_in_gafsa: boolean; pickup_in_store: boolean };
  items: Item[];
  locale: AppLocale;
  defaultPhone: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [delivery, setDelivery] = useState<DeliveryMethod>(
    shop.delivers_in_gafsa ? "delivery" : "pickup",
  );
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [phone, setPhone] = useState(defaultPhone);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function changeQuantity(item: Item, next: number) {
    startTransition(async () => {
      const result = next <= 0 ? await removeFromCart(item.id) : await setCartQuantity(item.id, next);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function onCheckout() {
    setError(null);

    startTransition(async () => {
      const result = await placeOrder({
        shopId: shop.id,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
        })),
        paymentMethod: payment,
        deliveryMethod: delivery,
        contactPhone: phone,
        deliveryAddress: delivery === "delivery" ? address : undefined,
        note,
      });

      if (result.ok) {
        setPlaced(result.data.order_number);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (placed) {
    return (
      <Card className="flex flex-col items-center gap-2 p-5 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[18px] font-bold text-[var(--color-brand)]">
          ✓
        </span>
        <p className="text-[13px] font-bold text-[var(--color-ink)]">{t.cart.placed}</p>
        <p className="text-[11px] text-[var(--color-muted)]">{placed}</p>
        <Button tone="ghost" size="sm" onClick={() => router.push("/commandes")}>
          {t.orders.title}
        </Button>
      </Card>
    );
  }

  const fieldInput =
    "w-full rounded-[14px] border border-[var(--color-outline)] bg-white/60 px-3 py-[10px] text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]";

  return (
    <Card className="flex flex-col gap-3 p-3">
      <p className="text-[12.5px] font-bold text-[var(--color-ink)]">{shop.name}</p>

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-[10px]">
          {item.product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniature fixe 52px
            <img
              src={item.product.images[0]}
              alt=""
              className="h-[52px] w-[52px] flex-none rounded-[14px] object-cover"
            />
          ) : (
            <Placeholder className="h-[52px] w-[52px] flex-none" rounded="thumb" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold text-[var(--color-ink)]">
              {item.product.name}
            </p>
            {(item.color || item.size) && (
              <p className="text-[10px] text-[var(--color-muted)]">
                {[item.size, item.color].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-[11px] font-bold text-[var(--color-brand)]">
              {formatPrice(item.product.price, locale)}
            </p>
          </div>

          <div className="flex flex-none items-center gap-2 rounded-[10px] bg-[var(--color-brand-tint)] px-2 py-1">
            <button
              type="button"
              onClick={() => changeQuantity(item, item.quantity - 1)}
              disabled={pending}
              aria-label="−"
              className="p-1 text-[var(--color-brand)]"
            >
              <MinusIcon size={12} />
            </button>
            <span className="min-w-[14px] text-center text-[11px] font-bold tabular-nums text-[var(--color-ink)]">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => changeQuantity(item, item.quantity + 1)}
              disabled={pending || item.quantity >= item.product.stock}
              aria-label="+"
              className="p-1 text-[var(--color-brand)] disabled:opacity-40"
            >
              <PlusIcon size={12} />
            </button>
          </div>
        </div>
      ))}

      <Divider />

      {/* ─── Mode de retrait ────────────────────────────────────────── */}
      <div className="flex gap-2">
        {shop.pickup_in_store && (
          <ModeButton
            active={delivery === "pickup"}
            onClick={() => setDelivery("pickup")}
            label={t.cart.pickup}
          />
        )}
        {shop.delivers_in_gafsa && (
          <ModeButton
            active={delivery === "delivery"}
            onClick={() => setDelivery("delivery")}
            label={t.cart.delivery}
          />
        )}
      </div>

      <div className="flex gap-2">
        <ModeButton
          active={payment === "cod"}
          onClick={() => setPayment("cod")}
          label={t.cart.paymentCod}
        />
        <ModeButton
          active={payment === "call"}
          onClick={() => setPayment("call")}
          label={t.cart.paymentCall}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--color-muted)]">{t.cart.contactPhone}</span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+216 …"
          className={fieldInput}
        />
      </label>

      {delivery === "delivery" && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[var(--color-muted)]">{t.cart.deliveryAddress}</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            autoComplete="street-address"
            className={fieldInput}
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--color-muted)]">{t.cart.note}</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} className={fieldInput} />
      </label>

      <Divider />

      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-[var(--color-muted)]">{t.cart.total}</span>
        <span className="text-[15px] font-bold text-[var(--color-brand)]">
          {formatPrice(subtotal, locale)}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <Button block onClick={onCheckout} disabled={pending || items.length === 0}>
        {pending ? t.cart.placing : t.cart.checkout}
      </Button>
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex-1 rounded-[12px] px-2 py-2 text-[10.5px] font-semibold transition-colors",
        active
          ? "bg-[var(--color-brand)] text-white"
          : "border border-[var(--color-outline)] text-[var(--color-muted)]",
      )}
    >
      {label}
    </button>
  );
}
