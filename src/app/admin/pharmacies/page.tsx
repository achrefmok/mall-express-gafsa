import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { tunisDateISO } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { PharmacyManager, type PharmacyItem } from "./pharmacy-manager";

export const metadata: Metadata = {
  title: "Pharmacies de garde",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPharmaciesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();

  const params = await searchParams;
  // Le jour affiché, dans le fuseau de Gafsa, ou celui demandé dans l'URL.
  const requested = params.date;
  const date =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : tunisDateISO();

  // Les pharmacies du jour choisi, pour les éditer.
  const { data: listed } = await supabase
    .from("pharmacies_on_duty")
    .select("*")
    .eq("on_date", date)
    .order("name");

  const today = tunisDateISO();
  const items: PharmacyItem[] = (listed ?? []).map((p) => ({
    id: p.id,
    on_date: p.on_date,
    name: p.name,
    address: p.address,
    phone: p.phone,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return (
    <>
      <TopBar title="Pharmacies de garde" back="/admin/reglages" />
      <PharmacyManager date={date} today={today} items={items} />
    </>
  );
}
