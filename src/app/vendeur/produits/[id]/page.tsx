import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { categoriesProduitPourBoutique } from "@/lib/categories-boutique-server";
import { resolveTheme } from "@/lib/boutique-themes";
import { lireAttributsProduits, lireMatieresProduits } from "@/lib/boutique-themes/attributs-server";
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
  const [{ data: product }, { locale }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    getT(),
  ]);

  if (!product) notFound();

  /*
    La catégorie actuelle du produit est toujours proposée, même hors de la
    famille de la boutique : un produit rangé avant ce filtre ne doit pas voir
    sa catégorie disparaître à l'ouverture.
  */
  const [{ categories, filtre }, attributsParProduit, matieresParProduit] = await Promise.all([
    categoriesProduitPourBoutique(shop, product.category_id),
    lireAttributsProduits(supabase, [product.id]),
    lireMatieresProduits(supabase, [product.id]),
  ]);

  const familleId = resolveTheme(shop.category?.slug).id;

  return (
    <ProductEditor
      product={product}
      categories={categories}
      categoriesFiltrees={filtre}
      locale={locale}
      familleId={familleId}
      attributsInitiaux={attributsParProduit.get(product.id) ?? {}}
      materiauxInitiaux={matieresParProduit.get(product.id) ?? []}
    />
  );
}
