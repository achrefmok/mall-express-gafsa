import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { DriverConsole } from "@/components/taxi/driver-console";
import { DriverInbox } from "@/components/taxi/driver-inbox";

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

  /*
    Pas de fiche, pas d'espace. L'accès s'ouvre depuis l'administration, jamais
    en devinant l'adresse — et la garde est ici, côté serveur, pas seulement dans
    le lien qu'on affiche ou non.
  */
  if (!driver) redirect("/taxi");

  return (
    <>
      <TopBar title={t.taxi.driverSpace} back="/taxi" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <DriverConsole initial={driver} />

        {/*
          Les messages viennent après la fiche, mais avant tout le reste.

          Un chauffeur ouvre cet écran pour deux choses : se déclarer libre, et
          voir qui le cherche. La seconde n'existait pas — les clients écrivaient
          dans le vide.
        */}
        <DriverInbox driverId={profile.id} />
      </div>
    </>
  );
}
