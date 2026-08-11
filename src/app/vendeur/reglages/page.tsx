import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { facebookConfigured, WEBHOOK_ENABLED } from "@/lib/live/facebook-graph";
import { ShopSettingsForm } from "./settings-form";
import type { FacebookLinkStatus } from "./facebook-link";

export const metadata: Metadata = {
  title: "Réglages boutique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ShopSettingsPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { locale } = await getT();
  const supabase = await createClient();

  const [hours, categories, selected, facebook] = await Promise.all([
    supabase.from("shop_hours").select("*").eq("shop_id", shop.id).order("weekday"),
    getCategories(false),
    supabase.from("shop_categories").select("category_id").eq("shop_id", shop.id),
    // `facebook_page_status` ne renvoie jamais le jeton d’accès : il reste
    // hors de portée du navigateur, y compris pour le propriétaire.
    supabase.rpc("facebook_page_status", { target_shop: shop.id }),
  ]);

  const link = facebook.data?.[0];
  const facebookStatus: FacebookLinkStatus = link
    ? {
        pageName: link.page_name,
        isSubscribed: link.is_subscribed,
        connectedAt: link.connected_at,
        lastCheckedAt: link.last_checked_at,
        lastError: link.last_error,
      }
    : null;

  // Sept jours garantis, même si la boutique n'en a jamais enregistré.
  const week = Array.from({ length: 7 }, (_, weekday) => {
    const existing = (hours.data ?? []).find((h) => h.weekday === weekday);
    return {
      weekday,
      opensAt: existing?.opens_at?.slice(0, 5) ?? "09:00",
      closesAt: existing?.closes_at?.slice(0, 5) ?? "20:00",
      isClosed: existing?.is_closed ?? false,
    };
  });

  return (
    <ShopSettingsForm
      shop={shop}
      hours={week}
      categories={categories}
      selectedCategoryIds={(selected.data ?? []).map((row) => row.category_id)}
      locale={locale}
      facebookStatus={facebookStatus}
      facebookConfigured={facebookConfigured()}
      facebookWebhookEnabled={WEBHOOK_ENABLED}
    />
  );
}
