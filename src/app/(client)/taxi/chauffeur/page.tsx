import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { DriverConsole } from "@/components/taxi/driver-console";

export const metadata: Metadata = {
  title: "Espace chauffeur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'espace du chauffeur : sa fiche, sa disponibilité, sa position.
 *
 * Ouvert à tout compte connecté — c'est ainsi qu'un chauffeur s'inscrit. Ce
 * n'est pas une faille : la fiche reste invisible des clients tant que
 * l'administration ne l'a pas approuvée, et la policy interdit au chauffeur de
 * s'approuver lui-même.
 */
export default async function DriverPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/taxi/chauffeur");

  const { t } = await getT();
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from("taxi_drivers")
    .select("display_name, phone, vehicle, plate, is_available, is_approved, position_updated_at")
    .eq("id", profile.id)
    .maybeSingle();

  return (
    <>
      <TopBar title={t.taxi.driverSpace} back="/taxi" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <DriverConsole initial={driver} />
      </div>
    </>
  );
}
