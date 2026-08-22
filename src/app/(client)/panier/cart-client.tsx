"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { placeOrder, removeFromCart, setCartQuantity } from "@/app/actions/cart";
import { cx, formatPrice } from "@/lib/format";
import { Button, Card, Divider, Placeholder, fieldClass } from "@/components/ui/primitives";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import type { AppLocale, DeliveryMethod, PaymentMethod } from "@/types/database";

interface Item {
  id: string;
  quantity: number;
  color: string | null;
  size: string | null;
  product: { id: string; name: string; price: number; images: string[]; stock: number };
}

interface Shop {
  id: string;
  name: string;
  slug: string;
  delivers_in_gafsa: boolean;
  pickup_in_store: boolean;
}

/** Ce que le client saisit une fois, quel que soit le nombre de boutiques. */
interface Contact {
  phone: string;
  address: string;
  note: string;
}

/**
 * Le panier entier, et les coordonnées au-dessus des boutiques.
 *
 * Chaque commerçant prépare et livre pour son compte : la commande reste
 * découpée par boutique, et c'est juste. La ressaisie, elle, ne l'était pas —
 * un panier réunissant trois commerçants demandait trois fois le téléphone,
 * l'adresse et la note, sur un téléphone, au moment précis où l'on abandonne.
 *
 * Les coordonnées remontent donc ici, saisies une seule fois. Chaque boutique
 * ne garde que ce qui lui appartient vraiment : son mode de retrait, son mode
 * de paiement, son total, son bouton.
 *
 * Avec une seule boutique, rien ne remonte : un bloc « Vos coordonnées » séparé
 * n'apporterait qu'une carte de plus à lire.
 */
export function CartGroups({
  groups,
  locale,
  defaultPhone,
}: {
  groups: Array<{ shop: Shop; items: Item[] }>;
  locale: AppLocale;
  defaultPhone: string;
}) {
  const { t } = useI18n();
  const [contact, setContact] = useState<Contact>({
    phone: defaultPhone,
    address: "",
    note: "",
  });

  const partage = groups.length > 1;

  /* Une adresse n'est demandée que si au moins une boutique livre. */
  const uneLivraisonPossible = groups.some((g) => g.shop.delivers_in_gafsa);

  return (
    <>
      {partage && (
        <Card className="flex flex-col gap-[10px] p-3">
          <p className="text-[0.78125rem] font-bold text-[var(--color-ink)]">{t.cart.yourDetails}</p>
          <ContactFields
            contact={contact}
            setContact={setContact}
            withAddress={uneLivraisonPossible}
          />
        </Card>
      )}

      {groups.map((group) => (
        <CartShopGroup
          key={group.shop.id}
          shop={group.shop}
          items={group.items}
          locale={locale}
          contact={contact}
          setContact={setContact}
          withFields={!partage}
        />
      ))}
    </>
  );
}

/**
 * Un bloc de panier par boutique, avec son propre passage en caisse.
 * Le total affiché ici est indicatif : le montant qui fait foi est calculé
 * par `place_order` côté base.
 */
function CartShopGroup({
  shop,
  items,
  locale,
  contact,
  setContact,
  withFields,
}: {
  shop: Shop;
  items: Item[];
  locale: AppLocale;
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact>>;
  /** Les champs de contact sont-ils rendus ici, ou au-dessus ? */
  withFields: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [delivery, setDelivery] = useState<DeliveryMethod>(
    shop.delivers_in_gafsa ? "delivery" : "pickup",
  );
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { phone, address, note } = contact;

  /*
    La quantité bouge sous le doigt, pas après l'aller-retour.

    Chaque « + » part au serveur puis rafraîchit la page entière : sur un réseau
    lent, le chiffre restait figé une seconde et l'on tapait une deuxième fois,
    persuadé que rien n'avait pris. `useOptimistic` affiche le résultat attendu
    immédiatement et revient de lui-même à la valeur du serveur si l'écriture
    échoue — sans état à réconcilier à la main.

    La ligne disparaît quand la quantité tombe à zéro : c'est ce que fera le
    serveur, autant le montrer tout de suite.
  */
  const [shownItems, applyOptimistic] = useOptimistic(
    items,
    (current: Item[], change: { id: string; quantity: number }) =>
      current
        .map((row) => (row.id === change.id ? { ...row, quantity: change.quantity } : row))
        .filter((row) => row.quantity > 0),
  );

  const subtotal = shownItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function changeQuantity(item: Item, next: number) {
    startTransition(async () => {
      applyOptimistic({ id: item.id, quantity: next });

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
        items: shownItems.map((item) => ({
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
        /*
          La confirmation vit sur la page des commandes, jamais ici.

          Elle s'affichait auparavant à la place de ce bloc, dans un état local.
          Or `place_order` vide le panier des articles commandés : au
          rafraîchissement suivant, la page parente ne trouvait plus de ligne
          pour cette boutique, le groupe disparaissait de la liste, et React
          démontait ce composant — emportant le numéro de commande avec lui. Le
          client validait son achat et ne voyait jamais sa référence.

          La renvoyer vers « Mes commandes » règle la question par la structure
          plutôt que par un correctif : la confirmation s'affiche là où la
          commande existe vraiment, elle survit à un rechargement, et le client
          se trouve déjà à l'endroit où il suivra sa livraison.
        */
        router.replace(`/commandes?nouvelle=${encodeURIComponent(result.data.order_number)}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <p className="text-[0.78125rem] font-bold text-[var(--color-ink)]">{shop.name}</p>

      {shownItems.map((item) => (
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
            <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
              {item.product.name}
            </p>
            {(item.color || item.size) && (
              <p className="text-[0.625rem] text-[var(--color-muted)]">
                {[item.size, item.color].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-[0.6875rem] font-bold text-[var(--color-brand)]">
              {formatPrice(item.product.price, locale)}
            </p>
          </div>

          {/*
            Les deux commandes font trente-deux pixels, contre vingt auparavant.

            C'est le réglage le plus manipulé du panier, et il était le plus
            petit. Les libellés nomment le produit : « moins » et « plus » seuls,
            lus à voix haute dans un panier de six articles, ne disent pas ce
            qu'on modifie.

            Elles ne se désactivent plus pendant l'écriture : la quantité est
            désormais optimiste, et bloquer les boutons ferait perdre les
            touchers rapides — exactement le geste qu'on veut servir.
          */}
          <div className="flex flex-none items-center gap-1 rounded-[12px] bg-[var(--color-brand-tint)] px-1">
            <button
              type="button"
              onClick={() => changeQuantity(item, item.quantity - 1)}
              aria-label={format(t.cart.decrease, { name: item.product.name })}
              className="flex h-8 w-8 items-center justify-center text-[var(--color-brand)]"
            >
              <MinusIcon size={14} />
            </button>
            <span className="min-w-[16px] text-center text-[0.6875rem] font-bold tabular-nums text-[var(--color-ink)]">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => changeQuantity(item, item.quantity + 1)}
              disabled={item.quantity >= item.product.stock}
              aria-label={format(t.cart.increase, { name: item.product.name })}
              className="flex h-8 w-8 items-center justify-center text-[var(--color-brand)] disabled:opacity-40"
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

      {withFields && (
        <>
          <ContactFields
            contact={contact}
            setContact={setContact}
            withAddress={delivery === "delivery"}
          />
          <Divider />
        </>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[0.71875rem] text-[var(--color-muted)]">{t.cart.total}</span>
        <span className="text-[0.9375rem] font-bold text-[var(--color-brand)]">
          {formatPrice(subtotal, locale)}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <Button block onClick={onCheckout} disabled={pending || shownItems.length === 0}>
        {pending ? t.cart.placing : t.cart.checkout}
      </Button>
    </Card>
  );
}

/**
 * Téléphone, adresse et note — les trois seuls champs de la caisse.
 *
 * Rendus au-dessus des boutiques quand il y en a plusieurs, dans le bloc de la
 * boutique quand il n'y en a qu'une. Le composant ne sait pas où il vit : il
 * reçoit la valeur et la fonction qui la met à jour.
 */
function ContactFields({
  contact,
  setContact,
  withAddress,
}: {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact>>;
  withAddress: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] text-[var(--color-muted)]">{t.cart.contactPhone}</span>
        <input
          value={contact.phone}
          onChange={(event) => setContact((c) => ({ ...c, phone: event.target.value }))}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+216 …"
          className={FIELD}
        />
      </label>

      {withAddress && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] text-[var(--color-muted)]">{t.cart.deliveryAddress}</span>
          <input
            value={contact.address}
            onChange={(event) => setContact((c) => ({ ...c, address: event.target.value }))}
            autoComplete="street-address"
            className={FIELD}
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] text-[var(--color-muted)]">{t.cart.note}</span>
        <input
          value={contact.note}
          onChange={(event) => setContact((c) => ({ ...c, note: event.target.value }))}
          className={FIELD}
        />
      </label>
    </>
  );
}

const FIELD =
  fieldClass({});

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
        "flex-1 rounded-[12px] px-2 py-2 text-[0.65625rem] font-semibold transition-colors",
        active
          ? "bg-[var(--color-brand-fill)] text-white"
          : "border border-[var(--color-outline)] text-[var(--color-muted)]",
      )}
    >
      {label}
    </button>
  );
}
