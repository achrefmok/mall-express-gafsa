import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { PosterStudio } from "@/components/vendor/poster-studio";

export const metadata: Metadata = {
  title: "Affiche marketing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Composer une affiche à publier, à partir de ses propres produits.
 *
 * Tout ce qui compose l'affiche est déjà en base — photos, noms, prix, remises,
 * numéro de téléphone. Il ne manquait qu'une mise en page, et c'est exactement
 * ce qu'une main pressée sur un écran de six pouces fait le moins bien.
 *
 * Les brouillons sont écartés : une affiche annonce des articles qu'on peut
 * acheter, et publier le prix d'un produit hors ligne ferait venir des clients
 * vers une page qui n'existe pas. Les produits sans photo restent, eux, dans la
 * liste — ils s'affichent avec leur prix seul, et leur absence de photo saute
 * alors aux yeux du vendeur, ce qui est le meilleur rappel possible.
 */
export default async function VendorPosterPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { t } = await getT();
  const supabase = await createClient();

  const { data: produits } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, images")
    .eq("shop_id", shop.id)
    .eq("is_draft", false)
    .eq("is_online", true)
    /*
      Les mieux vendus d'abord.

      Le vendeur compose une affiche pour vendre : lui présenter d'emblée ce qui
      part le mieux lui évite de faire défiler cent articles pour retrouver les
      trois qui marchent. À égalité, le plus récent passe devant — c'est
      généralement l'arrivage qu'il veut annoncer.
    */
    .order("sold_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <>
      <TopBar title={t.vendor.poster} back="/vendeur" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <PosterStudio
          boutique={shop.name}
          telephone={shop.phone}
          produits={(produits ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            compare_at_price: p.compare_at_price === null ? null : Number(p.compare_at_price),
            images: p.images ?? [],
          }))}
        />
      </div>
    </>
  );
}
