import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/queries";
import { enabledOAuthProviders } from "@/lib/auth/providers";
import { SignInScreen } from "./sign-in-screen";

export const metadata: Metadata = {
  title: "Se connecter",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  if (await getSessionUser()) redirect("/accueil");

  const params = await searchParams;
  const suite = params.suite?.startsWith("/") ? params.suite : undefined;

  // On n’affiche que les fournisseurs réellement activés : un bouton qui
  // mène à « Unsupported provider » vaut moins que pas de bouton.
  const providers = await enabledOAuthProviders();

  return <SignInScreen next={suite} initialError={params.erreur} providers={providers} />;
}
