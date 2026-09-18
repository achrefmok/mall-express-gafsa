import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { freeShopQuota } from "@/app/actions/deals";
import { NewDealForm } from "./new-deal-form";

export const metadata: Metadata = {
  title: "Publier sur Free Shop",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/free-shop/nouveau");

  const { locale } = await getT();
  const supabase = await createClient();

  const [shops, categories, quota] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, slug, logo_url, mall_level, category:categories!shops_category_id_fkey(hue)")
      .eq("status", "approved")
      .order("name")
      .limit(200),
    supabase
      .from("categories")
      .select("id, slug, name_fr, name_ar, hue")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order"),
    freeShopQuota(),
  ]);

  return (
    <NewDealForm
      shops={shops.data ?? []}
      categories={categories.data ?? []}
      locale={locale}
      quota={quota}
    />
  );
}
