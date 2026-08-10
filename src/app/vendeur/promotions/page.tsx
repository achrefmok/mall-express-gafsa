import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { PromotionsManager } from "./promotions-client";

export const metadata: Metadata = {
  title: "Promotions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VendorPromotionsPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <>
      <TopBar title={t.vendor.promotions} back="/vendeur" />
      <PromotionsManager promotions={promotions ?? []} locale={locale} />
    </>
  );
}
