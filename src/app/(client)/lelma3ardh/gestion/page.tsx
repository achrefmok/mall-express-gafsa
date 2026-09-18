import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { TopBar } from "@/components/shell/top-bar";
import { GestionLelma3ardh, type ExpoGeree, type ExposantGere, type ProduitGere } from "./gestion-client";

export const metadata: Metadata = {
  title: "Gestion Lelma3ardh",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'espace de Société Dahmani.
 *
 * Hors de `/admin`, et c'est le fond du sujet : un administrateur Dahmani
 * n'est pas un administrateur de l'application. Sous le même préfixe, la
 * séparation aurait tenu à une exception dans la garde de route — le genre
 * d'exception qu'on finit par oublier en ajoutant un écran.
 *
 * L'administration générale y entre aussi : elle garde tous les droits, et
 * doit pouvoir constater ce qui se passe ici.
 *
 * Le contrôle de rôle est écrit trois fois — intergiciel, page, policies —
 * et c'est voulu. Les deux premiers font un écran propre ; le troisième
 * seul fait une sécurité.
 */
export default async function GestionLelma3ardhPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/lelma3ardh/gestion");
  if (profile.role !== "dahmani_admin" && profile.role !== "admin") {
    redirect("/accueil?acces=refuse");
  }

  const supabase = await createClient();

  const [expos, exposants, produits] = await Promise.all([
    supabase
      .from("expos")
      .select("id, slug, name, name_ar, description, place, starts_on, ends_on, is_published")
      .order("starts_on", { ascending: false })
      .limit(50),

    supabase
      .from("expo_exhibitors")
      .select(
        `id, expo_id, slug, name, name_ar, description, stand_no, phone, whatsapp,
         facebook_url, instagram, address, logo_url, cover_url, images, status`,
      )
      .order("name")
      .limit(300),

    supabase
      .from("expo_products")
      .select("id, exhibitor_id, name, name_ar, price, compare_at_price, images, is_available, position")
      .order("position")
      .limit(1000),
  ]);

  return (
    <>
      <TopBar title="Lelma3ardh — gestion" back="/lelma3ardh" />
      <GestionLelma3ardh
        expos={(expos.data ?? []) as unknown as ExpoGeree[]}
        exposants={(exposants.data ?? []) as unknown as ExposantGere[]}
        produits={(produits.data ?? []) as unknown as ProduitGere[]}
      />
    </>
  );
}
