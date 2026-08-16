import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { GrantProvider, ProviderRow, type AdminProvider } from "./sos-admin-client";

export const metadata: Metadata = {
  title: "SOS dépannage",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Vérification des dépanneurs.
 *
 * Une fiche inscrite n'est visible d'aucun client tant qu'elle n'est pas
 * approuvée ici. La plateforme envoie des inconnus au domicile de ses clients :
 * le contrôle des pièces — identité, patente, assurance — se fait hors écran,
 * mais il doit se conclure ici.
 */
export default async function AdminSosPage() {
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from("sos_providers")
    .select("id, trade, display_name, phone, description, is_approved, is_available")
    .order("is_approved")
    .order("created_at", { ascending: false });

  const rows = (providers ?? []) as AdminProvider[];
  const pending = rows.filter((p) => !p.is_approved);
  const approved = rows.filter((p) => p.is_approved);

  return (
    <>
      <TopBar title="SOS dépannage" back="/admin/reglages" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Ouvrir l&apos;espace dépanneur</SectionTitle>
          <p className="text-[10.5px] leading-relaxed text-[var(--color-muted)]">
            Un artisan vous contacte ; vous lui ouvrez l&apos;espace ici, pour un métier précis. Il
            ne peut pas se l&apos;ouvrir lui-même, et le service n&apos;apparaît pas chez les autres
            membres.
          </p>
          <GrantProvider />
        </section>

        {rows.length === 0 ? (
          <EmptyState
            title="Aucun professionnel inscrit"
            body="Autorisez un membre ci-dessus : sa fiche apparaîtra ici pour vérification."
          />
        ) : (
          <>
            <section className="flex flex-none flex-col gap-2">
              <SectionTitle>À vérifier — {pending.length}</SectionTitle>
              <p className="text-[10.5px] leading-relaxed text-[var(--color-muted)]">
                Contrôlez identité et qualification avant d&apos;approuver. Une fiche approuvée
                apparaît auprès des clients avec son numéro de téléphone.
              </p>
              {pending.length === 0 ? (
                <p className="text-[11px] text-[var(--color-muted)]">Rien en attente.</p>
              ) : (
                pending.map((provider) => <ProviderRow key={provider.id} provider={provider} />)
              )}
            </section>

            <section className="flex flex-none flex-col gap-2">
              <SectionTitle>Approuvés — {approved.length}</SectionTitle>
              {approved.length === 0 ? (
                <p className="text-[11px] text-[var(--color-muted)]">Aucun pour l&apos;instant.</p>
              ) : (
                approved.map((provider) => <ProviderRow key={provider.id} provider={provider} />)
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
