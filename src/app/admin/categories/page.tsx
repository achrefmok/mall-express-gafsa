import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { CategoryManager } from "./categories-client";

export const metadata: Metadata = {
  title: "Catégories",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const { t } = await getT();
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("parent_id", { nullsFirst: true })
    .order("sort_order");

  return (
    <>
      <TopBar title={t.admin.manageCategories} back="/admin" />
      <CategoryManager categories={categories ?? []} />
    </>
  );
}
