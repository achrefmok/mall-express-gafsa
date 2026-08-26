import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatCount, formatPrice, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, Placeholder, SectionTitle, Tag } from "@/components/ui/primitives";
import { GearIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Ma boutique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Écran 8 — tableau de bord vendeur. */
export default async function VendorDashboard() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [sales, orderCount, recentOrders, lowStock] = await Promise.all([
    supabase
      .from("orders")
      .select("total")
      .eq("shop_id", shop.id)
      .neq("status", "cancelled")
      .gte("created_at", sevenDaysAgo),

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .gte("created_at", sevenDaysAgo),

    supabase
      .from("orders")
      .select(
        "id, order_number, status, created_at, buyer:profiles(first_name, last_name), items:order_items(product_name, product_image, quantity)",
      )
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(4),

    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .lte("stock", 3),
  ]);

  const revenue = (sales.data ?? []).reduce((sum, row) => sum + Number(row.total), 0);

  const setupTiles = [
    { href: "/vendeur/produits/nouveau", monogram: "+", label: t.vendor.addProduct },
    { href: "/vendeur/produits", monogram: "ST", label: t.vendor.manageStock },
    { href: "/vendeur/promotions", monogram: "PR", label: t.vendor.promotions },
    /* Juste après les promotions : c'est au moment où l'on baisse un prix
       qu'on veut l'annoncer, et l'affiche est le geste qui suit. */
    { href: "/vendeur/affiche", monogram: "AF", label: t.vendor.poster, accent: true },
    { href: "/vendeur/reglages#horaires", monogram: "HR", label: t.vendor.hours },
    { href: "/vendeur/reglages#localisation", monogram: "LO", label: t.vendor.location },
    { href: "/vendeur/lives/partage", monogram: "FB", label: "Relayer mon direct Facebook", accent: true },
    { href: "/vendeur/lives/nouveau", monogram: "LV", label: t.vendor.startLive, accent: true },
  ];

  return (
    <>
      <TopBar
        title={t.vendor.myShop}
        action={
          <Link href="/vendeur/reglages" aria-label={t.nav.settings} className="text-[var(--color-ink)]">
            <GearIcon />
          </Link>
        }
      />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[14px] pb-4">
        {/* ─── Bannière ─────────────────────────────────────────────── */}
        <div className="relative flex-none overflow-hidden rounded-[18px]">
          {shop.banner_url ? (
            <Image
              src={shop.banner_url}
              alt=""
              width={520}
              height={96}
              className="h-24 w-full object-cover"
            />
          ) : (
            <Placeholder label="bannière de la boutique" className="h-24 w-full" />
          )}
          <Link
            href="/vendeur/reglages#identite"
            className="absolute bottom-2 end-2 rounded-[14px] bg-[rgba(36,31,28,0.75)] px-[10px] py-[5px] text-[0.625rem] font-semibold text-white"
          >
            {t.vendor.editBanner}
          </Link>
        </div>

        {/* ─── Trois statistiques ───────────────────────────────────── */}
        <div className="grid flex-none grid-cols-3 gap-2">
          {[
            { value: formatPrice(revenue, locale), label: t.vendor.sales7d },
            { value: String(orderCount.count ?? 0), label: t.vendor.ordersCount },
            { value: formatCount(shop.views_count), label: t.vendor.visits },
          ].map((stat) => (
            <Card key={stat.label} className="p-[10px]">
              <p className="text-[1.1875rem] font-semibold text-[var(--color-brand)]">{stat.value}</p>
              <p className="text-[0.59375rem] text-[var(--color-muted)]">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/*
          Voir sa vitrine telle que les clients la voient. Le lien n'apparaît
          qu'une fois la boutique approuvée : `/boutique/[slug]` répond 404
          pour toute autre boutique, y compris auprès de son propriétaire.
        */}
        {shop.status === "approved" && (
          <Link
            href={`/boutique/${shop.slug}`}
            className="flex flex-none items-center gap-[10px] rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
          >
            <span className="w-6 flex-none text-[1rem] font-semibold tracking-[0.03125rem] text-[var(--color-brand)]">
              VU
            </span>
            <span className="flex-1 text-[0.75rem] font-semibold text-[var(--color-ink)]">
              {t.account.viewMyShop}
            </span>
            <span aria-hidden className="flex-none text-[0.6875rem] text-[var(--color-faint)]">
              ›
            </span>
          </Link>
        )}

        {/* ─── Configuration ────────────────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.setup}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {setupTiles.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="flex flex-col items-center gap-[6px] rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[12px_8px] shadow-[var(--shadow-card)]"
              >
                <span
                  className={`text-[1.0625rem] font-semibold ${
                    tile.accent ? "text-[var(--color-live)]" : "text-[var(--color-brand)]"
                  }`}
                >
                  {tile.monogram}
                </span>
                <span className="min-h-[25px] text-center text-[0.59375rem] leading-[1.3] text-[var(--color-ink)]">
                  {tile.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Alerte stock faible ──────────────────────────────────── */}
        {(lowStock.count ?? 0) > 0 && (
          <Link href="/vendeur/produits?filtre=stock-faible">
            <Card className="flex flex-none items-center gap-[10px] p-3">
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-live-tint)] text-[0.8125rem] font-bold text-[var(--color-live)]">
                !
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">
                  {format(t.vendor.tabsLowStock, { n: lowStock.count ?? 0 })}
                </p>
                <p className="text-[0.65625rem] text-[var(--color-muted)]">{t.vendor.quickRestock}</p>
              </div>
            </Card>
          </Link>
        )}

        {/* ─── Conseil live ─────────────────────────────────────────── */}
        <Card className="flex flex-none items-center gap-[10px] p-3">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.8125rem] font-bold text-[var(--color-brand)]">
            LV
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">
              {format(t.vendor.liveTipTitle, { slot: "jeudi 19h" })}
            </p>
            <p className="text-[0.65625rem] text-[var(--color-muted)]">
              {format(t.vendor.liveTipBody, { pct: 68 })}
            </p>
          </div>
          <Link
            href="/vendeur/lives/nouveau"
            className="flex-none whitespace-nowrap rounded-[12px] bg-[var(--color-brand-fill)] px-[11px] py-[6px] text-[0.625rem] font-bold text-white"
          >
            {t.vendor.schedule}
          </Link>
        </Card>

        {/* ─── Commandes récentes ───────────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.recentOrders}</SectionTitle>

          {(recentOrders.data ?? []).length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">{t.orders.empty}</p>
          ) : (
            recentOrders.data!.map((order) => {
              const first = order.items?.[0];
              return (
                <Link key={order.id} href="/vendeur/commandes">
                  <Card className="flex items-center gap-[10px] p-[11px]">
                    {first?.product_image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniature fixe 34px
                      <img
                        src={first.product_image}
                        alt=""
                        className="h-[34px] w-[34px] flex-none rounded-[14px] object-cover"
                      />
                    ) : (
                      <Placeholder className="h-[34px] w-[34px] flex-none" rounded="thumb" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
                        {first ? `${first.product_name} × ${first.quantity}` : order.order_number}
                      </p>
                      <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                        {order.buyer?.first_name} {order.buyer?.last_name?.[0]}. ·{" "}
                        {timeAgo(order.created_at, locale)}
                      </p>
                    </div>

                    <Tag tone={order.status === "delivered" ? "outline" : "tinted"}>
                      {t.orders.status[order.status]}
                    </Tag>
                  </Card>
                </Link>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
