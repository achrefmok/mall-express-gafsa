import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { DriverRow, GrantDriver } from "./taxi-admin-client";

export const metadata: Metadata = {
  title: "Chauffeurs de taxi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Vérification des chauffeurs.
 *
 * Un chauffeur inscrit n'est visible d'aucun client tant qu'il n'est pas
 * approuvé ici. La plateforme met en avant des inconnus auprès de ses clients,
 * et leur donne son numéro : le contrôle des pièces — permis, carte grise,
 * identité — se fait hors écran, mais il doit se conclure ici.
 */
export default async function AdminTaxiPage() {
  const supabase = await createClient();

  const { data: drivers } = await supabase
    .from("taxi_drivers")
    .select("id, display_name, phone, vehicle, plate, is_approved, is_available")
    .order("is_approved")
    .order("created_at", { ascending: false });

  const rows = drivers ?? [];
  const pending = rows.filter((d) => !d.is_approved);
  const approved = rows.filter((d) => d.is_approved);

  return (
    <>
      <TopBar title="Chauffeurs de taxi" back="/admin/reglages" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Ouvrir l&apos;espace chauffeur</SectionTitle>
          <p className="text-[0.65625rem] leading-relaxed text-[var(--color-muted)]">
            Un membre qui conduit un taxi vous contacte ; vous lui ouvrez l&apos;espace ici. Il ne
            peut pas se l&apos;ouvrir lui-même, et le lien n&apos;apparaît pas chez les autres.
          </p>
          <GrantDriver />
        </section>

        {rows.length === 0 ? (
          <EmptyState
            title="Aucun chauffeur inscrit"
            body="Les chauffeurs s'inscrivent depuis l'écran Taxi, puis apparaissent ici pour vérification."
          />
        ) : (
          <>
            <section className="flex flex-none flex-col gap-2">
              <SectionTitle>À vérifier — {pending.length}</SectionTitle>
              <p className="text-[0.65625rem] leading-relaxed text-[var(--color-muted)]">
                Contrôlez permis, carte grise et identité avant d&apos;approuver. Un chauffeur
                approuvé apparaît auprès des clients avec son numéro de téléphone.
              </p>
              {pending.length === 0 ? (
                <p className="text-[0.6875rem] text-[var(--color-muted)]">Rien en attente.</p>
              ) : (
                pending.map((driver) => <DriverRow key={driver.id} driver={driver} />)
              )}
            </section>

            <section className="flex flex-none flex-col gap-2">
              <SectionTitle>Approuvés — {approved.length}</SectionTitle>
              {approved.length === 0 ? (
                <p className="text-[0.6875rem] text-[var(--color-muted)]">Aucun pour l&apos;instant.</p>
              ) : (
                approved.map((driver) => <DriverRow key={driver.id} driver={driver} />)
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
