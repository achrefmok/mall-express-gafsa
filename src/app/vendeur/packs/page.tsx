import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { lirePacksBoutique } from "@/lib/boutique-themes/attributs-server";
import { PacksClient } from "./packs-client";

export const metadata: Metadata = {
  title: "Mes packs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Écran vendeur — packs Parapharmacie : grouper des produits avec une remise. */
export default async function VendorPacksPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const supabase = await createClient();
  const [packs, { data: produits }] = await Promise.all([
    lirePacksBoutique(supabase, shop.id),
    supabase
      .from("products")
      .select("id, name, price, images")
      .eq("shop_id", shop.id)
      .eq("is_online", true)
      .eq("is_draft", false)
      .order("name"),
  ]);

  return <PacksClient packs={packs} produits={produits ?? []} />;
}
