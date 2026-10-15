import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { CandidatureChauffeur } from "@/components/transport/candidature-chauffeur";

export const metadata: Metadata = { title: "Devenir chauffeur" };
export const dynamic = "force-dynamic";

/**
 * « Inscription chauffeur simplifiée » (amélioration demandée le 2026-10-15) :
 * la personne dépose elle-même sa candidature — nom, téléphone, véhicule,
 * plaque —, via l'action existante `registerDriver`.
 *
 * Ce qui ne change pas : la fiche reste invisible des clients tant que
 * l'administration ne l'a pas validée (policy `taxi_drivers_select`), et
 * `is_approved` n'est jamais écrit par le chauffeur (policy
 * `taxi_drivers_update_own`). La validation se fait dans `/admin/taxi`,
 * comme avant ; seule la porte d'entrée s'ouvre.
 */
export default async function DevenirChauffeur() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/devenir-chauffeur");
  const supabase = await createClient();
  const { data: fiche } = await supabase.from("taxi_drivers").select("id").eq("id", profile.id).maybeSingle();
  if (fiche) redirect("/profil/chauffeur");

  const { locale } = await getT();
  const nom = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return <CandidatureChauffeur locale={locale} nom={nom} telephone={profile.phone ?? ""} />;
}
