import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCategories, getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = {
  title: "Ajouter un produit",
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const [categories, { locale }] = await Promise.all([getCategories(false), getT()]);

  return <ProductEditor product={null} categories={categories} locale={locale} />;
}
