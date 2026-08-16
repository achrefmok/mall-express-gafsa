import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { ProviderConsole, type ProviderProfile } from "@/components/sos/provider-console";

export const metadata: Metadata = {
  title: "Espace dépanneur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** L'espace du dépanneur : sa fiche, sa disponibilité, sa position. */
export default async function SosProPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/sos/pro");

  const { t } = await getT();
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("sos_providers")
    .select("trade, display_name, phone, description, travels, is_available, is_approved, position_updated_at")
    .eq("id", profile.id)
    .maybeSingle();

  /*
    Pas de fiche, pas d'espace.

    L'accès s'ouvre depuis l'administration, jamais en devinant l'adresse — et la
    garde est ici, côté serveur, pas seulement dans le lien qu'on affiche ou non.
  */
  if (!provider) redirect("/sos");

  return (
    <>
      <TopBar title={t.sos.proSpace} back="/sos" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <ProviderConsole initial={provider as ProviderProfile} />
      </div>
    </>
  );
}
