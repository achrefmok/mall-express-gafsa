import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import {
  RoueVendeur,
  type LotVendeur,
  type ProduitBoutique,
  type RoueVendeurRow,
  type TourJoue,
} from "./roue-client";

export const metadata: Metadata = {
  title: "Roue de la chance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * La roue du commerçant : ses lots, son quota, ses gagnants.
 *
 * Trois choses sur un écran parce qu'elles se répondent : on ajuste un poids
 * en regardant ce qui est sorti, et on coupe la roue en voyant qu'il ne reste
 * plus rien à remettre.
 */
export default async function VendorWheelPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { locale } = await getT();
  const supabase = await createClient();

  const { data: roue } = await supabase
    .from("shop_wheels")
    .select("id, title, title_ar, is_active, spins_per_day, ends_at")
    .eq("shop_id", shop.id)
    .maybeSingle();

  const [lots, tours, produits] = await Promise.all([
    roue
      ? supabase
          .from("wheel_prizes")
          .select("id, label, label_ar, weight, is_win, stock, image_url, position")
          .eq("wheel_id", roue.id)
          .order("position")
      : Promise.resolve({ data: [] }),

    roue
      ? supabase
          .from("wheel_spins")
          .select(
            "id, code, created_at, claimed_at, prize:wheel_prizes!wheel_spins_prize_id_fkey(label, is_win), joueur:profiles!wheel_spins_user_id_fkey(first_name, last_name, phone)",
          )
          .eq("wheel_id", roue.id)
          .order("created_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] }),

    /*
      Le catalogue, pour composer une case sans rien retaper.

      Les produits en ligne seulement : offrir un article qu'on ne vend
      plus mettrait le commerçant dans l'embarras au moment de le remettre.
    */
    supabase
      .from("products")
      .select("id, name, price, images")
      .eq("shop_id", shop.id)
      .eq("is_online", true)
      .eq("is_draft", false)
      .order("name")
      .limit(200),
  ]);

  return (
    <>
      <TopBar title="Roue de la chance" back="/vendeur" />
      <RoueVendeur
        roue={(roue ?? null) as RoueVendeurRow | null}
        lots={(lots.data ?? []) as unknown as LotVendeur[]}
        tours={(tours.data ?? []) as unknown as TourJoue[]}
        produits={(produits.data ?? []) as unknown as ProduitBoutique[]}
        locale={locale}
      />
    </>
  );
}
