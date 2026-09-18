import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { PartenairesAdmin, type BoutiquePartenaire, type ReservationAdmin } from "./partenaires-client";

export const metadata: Metadata = {
  title: "Partenaires",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * La supervision des partenaires.
 *
 * Deux choses seulement se décident ici : qui est partenaire, et dans quel
 * ordre les partenaires passent sur l'accueil. Le reste — produits, photos,
 * prix, promotions, horaires — appartient au commerçant et se tient dans son
 * espace vendeur, qui sait déjà tout faire. Le dupliquer ici aurait donné deux
 * écrans pour une même donnée, et la question « lequel fait foi ? ».
 *
 * Les réservations sont listées en lecture : l'administration doit pouvoir
 * constater qu'un partenaire laisse ses demandes sans réponse, sans pouvoir
 * répondre à sa place.
 */
export default async function AdminPartenairesPage() {
  const { locale } = await getT();
  const supabase = await createClient();

  const [boutiques, reservations] = await Promise.all([
    supabase
      .from("shops")
      .select(
        `id, slug, name, logo_url, status, is_partner, partner_rank,
         partner_tagline, accepts_reservations`,
      )
      .eq("status", "approved")
      .order("is_partner", { ascending: false })
      .order("partner_rank", { ascending: true, nullsFirst: false })
      .order("name")
      .limit(300),

    supabase
      .from("reservations")
      .select("id, full_name, phone, party_size, desired_at, status, created_at, shop:shops!reservations_shop_id_fkey(name, slug)")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <>
      <TopBar title="Partenaires" />
      <PartenairesAdmin
        boutiques={(boutiques.data ?? []) as unknown as BoutiquePartenaire[]}
        reservations={(reservations.data ?? []) as unknown as ReservationAdmin[]}
        locale={locale}
      />
    </>
  );
}
