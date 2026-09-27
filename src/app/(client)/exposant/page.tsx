import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { EspaceExposant, type ExposantMoi, type ProduitExposant } from "./exposant-client";

export const metadata: Metadata = {
  title: "Mon stand",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'espace du titulaire d'un stand Lelma3ardh.
 *
 * Même garde à trois niveaux que `/lelma3ardh/gestion` : intergiciel, page,
 * politiques. Ici, la page vérifie en plus que le compte est bien rattaché
 * à un stand — un rôle « exhibitor » sans ligne dans `expo_exhibitors` ne
 * devrait jamais exister, mais l'écran reste correct si ça arrivait.
 */
export default async function ExposantPage() {
  const { t } = await getT();
  const profile = await getProfile();

  if (!profile) redirect("/connexion?suite=/exposant");
  if (profile.role !== "exhibitor" && profile.role !== "dahmani_admin" && profile.role !== "admin") {
    redirect("/accueil?acces=refuse");
  }

  const supabase = await createClient();

  const { data: exhibitor } = await supabase
    .from("expo_exhibitors")
    .select(
      `id, expo_id, slug, name, name_ar, description, description_ar, stand_no, phone, whatsapp,
       facebook_url, instagram, address, logo_url, cover_url, images, status`,
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!exhibitor) {
    return (
      <>
        <TopBar title={t.dahmani.myStand} />
        <div className="flex flex-1 items-center justify-center px-4">
          <EmptyState title={t.common.empty} />
        </div>
      </>
    );
  }

  const { data: produits } = await supabase
    .from("expo_products")
    .select("id, name, name_ar, description, price, compare_at_price, images, is_available, position")
    .eq("exhibitor_id", exhibitor.id)
    .order("position");

  return (
    <>
      <TopBar title={t.dahmani.myStand} />
      <EspaceExposant
        exhibitor={exhibitor as ExposantMoi}
        produits={(produits ?? []) as ProduitExposant[]}
      />
    </>
  );
}
