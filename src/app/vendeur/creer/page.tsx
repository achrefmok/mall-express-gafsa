import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCategories, getMyShop } from "@/lib/queries";
import { CreateShopForm } from "./create-shop-form";

export const metadata: Metadata = {
  title: "Créer ma boutique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Écran d'amorçage pour un vendeur sans boutique — inscription sans nom de
 * boutique, ou client promu vendeur depuis la console.
 */
export default async function CreateShopPage() {
  const shop = await getMyShop();
  if (shop) redirect("/vendeur");

  const categories = await getCategories();

  return <CreateShopForm categories={categories} />;
}
