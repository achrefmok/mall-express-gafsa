import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AnnuaireLieux } from "@/components/annuaire/annuaire-lieux";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.annuaire.sportTitle, description: t.annuaire.sportIntro };
}

/** Salles de sport, terrains, clubs, parcs de jeux et espaces de loisirs. */
export default function PageSportLoisirs() {
  return <AnnuaireLieux famille="sport-loisirs" />;
}
