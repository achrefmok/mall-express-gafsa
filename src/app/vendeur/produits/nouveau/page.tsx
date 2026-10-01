import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { categoriesProduitPourBoutique } from "@/lib/categories-boutique-server";
import { resolveTheme } from "@/lib/boutique-themes";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = {
  title: "Ajouter un produit",
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  // Les catégories de la famille de la boutique, pas celles de tout le mall.
  const [{ categories, filtre }, { locale }] = await Promise.all([
    categoriesProduitPourBoutique(shop),
    getT(),
  ]);

  const familleId = resolveTheme(shop.category?.slug).id;

  return (
    <ProductEditor
      product={null}
      categories={categories}
      categoriesFiltrees={filtre}
      locale={locale}
      familleId={familleId}
    />
  );
}
