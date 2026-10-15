import type { Metadata } from "next";
import { InscriptionTransport } from "@/components/transport/formulaires-acces";

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Commandez un taxi à Gafsa, réservez votre louage — ou inscrivez-vous comme chauffeur.",
};

/** Inscription ouverte à tous (décision du 2026-10-15), parcours chauffeur compris. */
export default async function PageInscriptionTransport({ searchParams }: { searchParams: Promise<{ chauffeur?: string }> }) {
  const { chauffeur } = await searchParams;
  return <InscriptionTransport chauffeurParDefaut={chauffeur === "1"} />;
}
