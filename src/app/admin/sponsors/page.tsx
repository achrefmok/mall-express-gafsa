import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { SponsorsManager } from "./sponsors-client";

export const metadata: Metadata = {
  title: "Emplacements sponsorisés",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSponsorsPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [slots, shops] = await Promise.all([
    supabase
      .from("sponsored_slots")
      .select("*")
      .order("is_active", { ascending: false })
      .order("position")
      .limit(50),

    supabase
      .from("shops")
      .select("id, name")
      .eq("status", "approved")
      .order("name")
      .limit(200),
  ]);

  return (
    <>
      <TopBar title={t.admin.sponsoredSlots} back="/admin" />
      <SponsorsManager slots={slots.data ?? []} shops={shops.data ?? []} locale={locale} />
    </>
  );
}
