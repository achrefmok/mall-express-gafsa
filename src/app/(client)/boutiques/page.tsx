import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { ShopsMap, type ShopPin } from "@/components/shops/shops-map";

export const metadata: Metadata = {
  title: "Boutiques vérifiées de Gafsa",
  description:
    "La carte des boutiques vérifiées du mall de Gafsa : où elles se trouvent, leur local, et l'itinéraire pour s'y rendre.",
  alternates: { canonical: "/boutiques" },
};

// Une boutique change d'adresse ou de local rarement, mais une nouvelle
// approbation doit apparaître le jour même.
export const revalidate = 300;

/**
 * La carte des boutiques.
 *
 * `status = approved` n'est pas un filtre d'affichage, c'est la promesse de
 * l'écran : un client qui se déplace doit trouver un commerce que la plateforme
 * a contrôlé. Une boutique en attente n'y figure pas, même si elle a renseigné
 * sa position.
 */
export default async function ShopsPage() {
  const { t } = await getT();
  const supabase = await createClient();

  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, slug, phone, latitude, longitude, mall_level, mall_unit")
    .eq("status", "approved")
    .order("followers_count", { ascending: false });

  return (
    <>
      <TopBar title={t.shops.title} />

      <div className="col-reading flex flex-1 flex-col gap-3 overflow-hidden px-4 pt-2">
        <ShopsMap shops={(shops ?? []) as ShopPin[]} />
      </div>
    </>
  );
}
