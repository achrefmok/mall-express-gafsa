import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { NewLiveForm } from "./new-live-form";

export const metadata: Metadata = {
  title: "Nouveau direct",
  robots: { index: false, follow: false },
};

export default async function NewLivePage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .eq("shop_id", shop.id)
    .eq("is_online", true)
    .eq("is_draft", false)
    .order("name")
    .limit(100);

  return <NewLiveForm products={products ?? []} shopApproved={shop.status === "approved"} />;
}
