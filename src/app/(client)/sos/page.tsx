import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { SosClient, type Provider } from "@/components/sos/sos-client";

export const metadata: Metadata = {
  title: "SOS dépannage",
  description:
    "Mécanicien, électricien, plombier, remorquage : les professionnels vérifiés de Gafsa, disponibles maintenant.",
};

export const dynamic = "force-dynamic";

/**
 * SOS côté client.
 *
 * Les fiches non approuvées sont écartées par la policy de la table, pas par
 * cette requête : la plateforme envoie des inconnus au domicile de ses clients,
 * et cette garantie doit tenir même si quelqu'un interroge l'API directement.
 */
export default async function SosPage() {
  const { t } = await getT();
  const supabase = await createClient();

  const profile = await getProfile();

  const [{ data: providers }, mine] = await Promise.all([
    supabase
      .from("sos_providers")
      .select("id, trade, display_name, phone, description, travels, is_available, lat, lng, position_updated_at")
      .eq("is_approved", true)
      .order("is_available", { ascending: false }),

    /*
      L'espace dépanneur n'existe que pour qui a reçu l'accès.

      Même principe que pour le taxi : l'administration ouvre la porte, et le
      lien n'apparaît nulle part ailleurs. Sans cela, la file de vérification se
      remplirait de comptes inscrits par curiosité.
    */
    profile
      ? supabase
          .from("sos_providers")
          .select("id")
          .eq("id", profile.id)
          .maybeSingle()
          .then(({ data }) => Boolean(data))
      : Promise.resolve(false),
  ]);

  return (
    <>
      <TopBar title={t.sos.title} />

      <div className="col-reading flex flex-1 flex-col gap-3 overflow-hidden px-4 pt-2">
        <SosClient initialProviders={(providers ?? []) as Provider[]} />

        {mine && (
          <Link
            href="/sos/pro"
            className="flex-none pb-3 text-center text-[0.6875rem] font-semibold text-[var(--color-brand)]"
          >
            {t.sos.proSpace}
          </Link>
        )}
      </div>
    </>
  );
}
