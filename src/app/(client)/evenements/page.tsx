import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AnnuaireLieux } from "@/components/annuaire/annuaire-lieux";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.annuaire.feteTitle, description: t.annuaire.feteIntro };
}

/** Salles des fêtes, salles de mariage, espaces événementiels. */
export default function PageEvenements() {
  return <AnnuaireLieux famille="fete-evenements" />;
}
