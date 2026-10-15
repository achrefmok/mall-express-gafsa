import type { Metadata, Viewport } from "next";

/*
  « Taxi & Louage Gafsa » — l'application de transport sur son propre domaine
  (src/lib/transport.ts). Ces pages ne s'atteignent que par la réécriture de
  l'intergiciel : sur l'hôte G-Mall, `/transport/…` renvoie à l'accueil.

  Les métadonnées remplacent celles de G-Mall pour tout l'arbre : titre des
  onglets, nom à l'installation, couleur de la barre du système.
*/
export const metadata: Metadata = {
  title: {
    // `absolute` : sinon le gabarit « %s · G-Mall » de la racine s'y ajoute.
    absolute: "Taxi & Louage Gafsa — un taxi en quelques minutes",
    template: "%s · Taxi & Louage Gafsa",
  },
  description:
    "Commandez un taxi à Gafsa en quelques minutes, suivez votre chauffeur et réservez votre place en louage. En français et en arabe.",
  applicationName: "Taxi & Louage Gafsa",
  appleWebApp: { capable: true, title: "Taxi Gafsa", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: "Taxi & Louage Gafsa",
    title: "Taxi & Louage Gafsa",
    description: "Un taxi en quelques minutes, votre place en louage.",
  },
};

export const viewport: Viewport = {
  themeColor: "#14161c",
};

export default function TransportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
