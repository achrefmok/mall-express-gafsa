import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { TopBar } from "@/components/shell/top-bar";
import { TaxiClient } from "@/components/taxi/taxi-client";

export const metadata: Metadata = {
  title: "Taxi",
  description: "Trouvez un taxi libre à Gafsa : qui est disponible, où il se trouve, et son numéro.",
};

export const dynamic = "force-dynamic";

/**
 * Écran taxi côté client.
 *
 * Les chauffeurs non approuvés sont écartés par la policy de la table, pas par
 * cette requête : la plateforme met en avant des inconnus auprès de ses clients,
 * et cette garantie doit tenir même si quelqu'un interroge l'API directement.
 */
export default async function TaxiPage() {
  const { t } = await getT();
  const supabase = await createClient();

  const profile = await getProfile();

  const [{ data: drivers }, mine] = await Promise.all([
    supabase
      .from("taxi_drivers")
      .select("id, display_name, phone, vehicle, plate, is_available, lat, lng")
      .eq("is_approved", true)
      .order("is_available", { ascending: false }),

    /*
      L'espace chauffeur n'existe que pour qui a reçu l'accès.

      Un membre qui conduit un taxi contacte l'administration, qui lui ouvre la
      porte. Afficher le lien à tout le monde reviendrait à proposer une
      fonctionnalité qui ne concerne presque personne, et à remplir la file de
      vérification de comptes qui se sont inscrits par curiosité.
    */
    profile
      ? supabase
          .from("taxi_drivers")
          .select("id")
          .eq("id", profile.id)
          .maybeSingle()
          .then(({ data }) => Boolean(data))
      : Promise.resolve(false),
  ]);

  return (
    <>
      <TopBar title={t.taxi.title} />

      <div className="col-reading flex flex-1 flex-col gap-3 overflow-hidden px-4 pt-2">
        <TaxiClient initialDrivers={drivers ?? []} />

        {/* Un chauffeur arrive par cet écran comme n'importe quel client :
            c'est le seul endroit où il pense à chercher. */}
        {mine && (
          <Link
            href="/taxi/chauffeur"
            className="flex-none pb-3 text-center text-[11px] font-semibold text-[var(--color-brand)]"
          >
            {t.taxi.driverSpace}
          </Link>
        )}
      </div>
    </>
  );
}
