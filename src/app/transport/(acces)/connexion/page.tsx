import type { Metadata } from "next";
import { ConnexionTransport } from "@/components/transport/formulaires-acces";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

/** Le lien de connexion propre à « Taxi & Louage Gafsa ». */
export default async function PageConnexionTransport({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  return <ConnexionTransport suite={suite?.startsWith("/") && !suite.startsWith("//") ? suite : undefined} />;
}
