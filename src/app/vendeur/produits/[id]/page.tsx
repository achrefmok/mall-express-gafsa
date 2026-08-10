import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = {
  title: "Modifier un produit",
  robots: { index: false, follow: false },
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const supabase = await createClient();
  const [{ data: product }, categories, { locale }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    getCategories(false),
    getT(),
  ]);

  if (!product) notFound();

  return <ProductEditor product={product} categories={categories} locale={locale} />;
}
