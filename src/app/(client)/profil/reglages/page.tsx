import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/queries";
import { AccountSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Réglages du compte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/profil/reglages");

  return <AccountSettingsForm profile={profile} />;
}
