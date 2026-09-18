import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { ReservationsVendeur, type ReservationVendeur } from "./reservations-client";

export const metadata: Metadata = {
  title: "Réservations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Les réservations reçues par le commerçant.
 *
 * Les demandes en attente d'abord, et parmi elles la plus proche en haut :
 * une table pour ce soir passe avant une table pour samedi, quelle que soit
 * l'heure à laquelle les deux sont arrivées. C'est le seul tri qui suive le
 * travail réel.
 *
 * La lecture est filtrée par la policy — `owns_shop(shop_id)` — et non par ce
 * fichier. Le `eq("shop_id")` ci-dessous ne sert qu'à éviter de rapporter des
 * lignes que la base écarterait de toute façon.
 */
export default async function VendorReservationsPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { locale } = await getT();
  const supabase = await createClient();

  const { data } = await supabase
    .from("reservations")
    .select(
      `id, full_name, phone, party_size, desired_at, note, status, refusal_reason,
       created_at, handled_at,
       product:products!reservations_product_id_fkey(name)`,
    )
    .eq("shop_id", shop.id)
    .order("desired_at", { ascending: true })
    .limit(200);

  const reservations = (data ?? []) as unknown as ReservationVendeur[];

  return (
    <>
      <TopBar title="Réservations" back="/vendeur" />

      {reservations.length === 0 ? (
        <EmptyState
          title="Aucune réservation"
          body="Les demandes de vos clients arriveront ici. Activez-les dans vos réglages si ce n'est pas déjà fait."
        />
      ) : (
        <ReservationsVendeur reservations={reservations} locale={locale} />
      )}
    </>
  );
}
