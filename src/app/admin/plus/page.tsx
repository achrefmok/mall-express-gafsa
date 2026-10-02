import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/shell/top-bar";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { ChevronRightIcon, FlagIcon, GearIcon, GridIcon, HeartIcon, SparkIcon, StoreIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Plus",
  robots: { index: false, follow: false },
};

/**
 * Le reste de la console, groupé par thème plutôt qu'à plat.
 *
 * Neuf écrans vivaient sur la même barre d'onglets (voir `nav-items.tsx`) ;
 * les cinq les plus consultés y restent, le reste vit ici. Rien n'a changé
 * dans les écrans eux-mêmes — seulement la façon d'y arriver.
 */
export default function AdminPlusPage() {
  const groups: Array<{ titre: string; liens: Array<{ href: string; label: string; icone: React.ReactNode }> }> = [
    {
      titre: "Modération",
      liens: [{ href: "/admin/signalements", label: "Signalements", icone: <FlagIcon size={18} /> }],
    },
    {
      titre: "Commerce",
      liens: [
        { href: "/admin/partenaires", label: "Partenaires", icone: <StoreIcon size={18} /> },
        { href: "/admin/sponsors", label: "Régie publicitaire", icone: <SparkIcon size={18} /> },
        { href: "/admin/free-shop", label: "G-Shop", icone: <HeartIcon size={18} /> },
        { href: "/admin/black-friday", label: "Black Friday", icone: <SparkIcon size={18} /> },
        { href: "/admin/pharmacies", label: "Pharmacies de garde", icone: <SparkIcon size={18} /> },
      ],
    },
    {
      titre: "Catalogue",
      liens: [{ href: "/admin/categories", label: "Catégories", icone: <GridIcon size={18} /> }],
    },
    {
      titre: "Paramètres",
      liens: [{ href: "/admin/reglages", label: "Réglages", icone: <GearIcon size={18} /> }],
    },
  ];

  return (
    <>
      <TopBar title="Plus" />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
        {groups.map((group) => (
          <section key={group.titre} className="flex flex-none flex-col gap-2">
            <SectionTitle>{group.titre}</SectionTitle>
            <Card className="flex flex-col divide-y divide-[var(--color-hairline)] p-0">
              {group.liens.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className="flex items-center gap-3 p-[13px] text-[0.8125rem] font-semibold text-[var(--color-ink)]"
                >
                  <span aria-hidden className="flex-none text-[var(--color-brand)]">
                    {lien.icone}
                  </span>
                  <span className="min-w-0 flex-1">{lien.label}</span>
                  <ChevronRightIcon size={15} className="flex-none text-[var(--color-faint)] rtl:rotate-180" />
                </Link>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}
