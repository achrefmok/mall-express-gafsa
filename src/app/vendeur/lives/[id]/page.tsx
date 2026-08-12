import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { TopBar } from "@/components/shell/top-bar";
import { BroadcastConsole } from "@/components/live/broadcast-console";

export const metadata: Metadata = {
  title: "Console de direct",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VendorLiveConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const supabase = await createClient();

  const [{ data: live }, { data: products }] = await Promise.all([
    supabase
      .from("lives")
      .select("id, title, status, source, facebook_url, hls_url, pinned_product_id, live_percent_off")
      .eq("id", id)
      .eq("shop_id", shop.id)
      .maybeSingle(),

    supabase
      .from("products")
      .select("id, name, price, stock")
      .eq("shop_id", shop.id)
      .eq("is_online", true)
      .eq("is_draft", false)
      .order("name")
      .limit(100),
  ]);

  if (!live) notFound();

  return (
    <>
      <TopBar title={live.title} back="/vendeur/lives" />
      <BroadcastConsole live={live} products={products ?? []} />
    </>
  );
}
