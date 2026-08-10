import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/queries";
import { enabledOAuthProviders } from "@/lib/auth/providers";
import { SignUpScreen } from "./sign-up-screen";

export const metadata: Metadata = {
  title: "Créer mon compte",
  description:
    "Rejoignez Mall Express Gafsa en trois minutes — client ou commerçant. Zéro commission les trois premiers mois.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; parrain?: string }>;
}) {
  if (await getSessionUser()) redirect("/accueil");

  const params = await searchParams;

  return (
    <SignUpScreen
      initialRole={params.role === "vendeur" || params.role === "vendor" ? "vendor" : "client"}
      referralCode={params.parrain}
      providers={await enabledOAuthProviders()}
    />
  );
}
