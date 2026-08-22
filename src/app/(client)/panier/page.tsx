import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState, ButtonLink } from "@/components/ui/primitives";
import { CartIcon } from "@/components/ui/icons";
import { CartGroups } from "./cart-client";

export const metadata: Metadata = {
  title: "Panier",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/panier");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("cart_items")
    .select(
      `id, quantity, color, size,
       product:products!inner(
         id, name, price, images, stock, is_online,
         shop:shops!inner(id, name, slug, delivers_in_gafsa, pickup_in_store)
       )`,
    )
    .eq("user_id", profile.id)
    .order("created_at");

  const rows = (items ?? []).filter((row) => row.product?.shop);

  /*
   * Une commande par boutique : chaque commerçant prépare et livre pour son
   * compte, il ne peut pas y avoir de commande transverse.
   */
  const groups = Object.values(
    rows.reduce<
      Record<
        string,
        {
          shop: NonNullable<(typeof rows)[number]["product"]>["shop"];
          items: typeof rows;
        }
      >
    >((acc, row) => {
      const shop = row.product!.shop!;
      acc[shop.id] ??= { shop, items: [] };
      acc[shop.id].items.push(row);
      return acc;
    }, {}),
  );

  return (
    <>
      <TopBar title={t.cart.title} back="/marketplace" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
        {groups.length === 0 ? (
          <EmptyState
            title={t.cart.empty}
            body={t.cart.emptyBody}
            icon={<CartIcon size={20} />}
            action={
              <ButtonLink href="/marketplace" size="sm" className="mt-1">
                {t.nav.marketplace}
              </ButtonLink>
            }
          />
        ) : (
          <>
            {groups.length > 1 && (
              <p className="text-[0.65625rem] text-[var(--color-muted)]">{t.cart.perShop}</p>
            )}
            <CartGroups
              locale={locale}
              defaultPhone={profile.phone ?? ""}
              groups={groups.map((group) => ({
                shop: group.shop,
                items: group.items.map((row) => ({
                  id: row.id,
                  quantity: row.quantity,
                  color: row.color,
                  size: row.size,
                  product: {
                    id: row.product!.id,
                    name: row.product!.name,
                    price: row.product!.price,
                    images: row.product!.images ?? [],
                    stock: row.product!.stock,
                  },
                })),
              }))}
            />
          </>
        )}
      </div>
    </>
  );
}
