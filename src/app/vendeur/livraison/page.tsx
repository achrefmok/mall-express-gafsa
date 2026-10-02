import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { lireZonesLivraison } from "@/lib/boutique-themes/attributs-server";
import { LivraisonClient } from "./livraison-client";

export const metadata: Metadata = {
  title: "Tarifs de livraison",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Écran vendeur — Services (livraison) : zones, prix et délais. */
export default async function VendorLivraisonPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const supabase = await createClient();
  const zones = await lireZonesLivraison(supabase, shop.id);

  return <LivraisonClient zones={zones} />;
}
