import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { getPreferences } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/provider";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ServiceWorkerBridge } from "@/components/pwa/service-worker-bridge";
import { NavDepthTracker } from "@/components/shell/back";
import "./globals.css";

import { siteUrl as resolveSiteUrl } from "@/lib/site-url";
import { WebVitals } from "@/components/shell/web-vitals";
import { lireMarque } from "@/lib/brand";

const siteUrl = resolveSiteUrl();

/**
 * Cairo couvre le latin et l'arabe : une seule famille pour les deux
 * directions, comme spécifié dans le handoff. Servie depuis notre domaine
 * (next/font), donc pas d'aller-retour vers Google au premier rendu — ce qui
 * compte sur les connexions mobiles visées.
 */
const cairo = Cairo({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "G-Mall — boutiques, marketplace et services de Gafsa",
    template: "%s · G-Mall",
  },
  description:
    "Les boutiques du mall de Gafsa en ligne : marketplace, ventes en direct, bons plans partagés par les habitants et services citoyens. En français et en arabe.",
  applicationName: "G-Mall",
  /*
    Le manifeste n'est pas déclaré ici mais dans <head>, à la main.

    `metadata.manifest` émet un <link> sans attribut `crossorigin`, et le
    navigateur récupère alors le manifeste *sans* cookie. Derrière tout portail
    à session — la Deployment Protection de Vercel sur une prévisualisation, un
    intranet, une authentification d'entreprise — la requête est redirigée vers
    un autre domaine, ce qui donne `ERR_FAILED` en boucle, casse l'invitation à
    installer, et fait échouer le préchargement du service worker.

    `use-credentials` fait envoyer les cookies de même origine. Sans effet sur
    un site public, indispensable dès qu'il y en a un.
  */
  appleWebApp: {
    capable: true,
    title: "G-Mall",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "fr_TN",
    alternateLocale: "ar_TN",
    siteName: "G-Mall",
    url: siteUrl,
    title: "G-Mall",
    description:
      "Marketplace, ventes en direct, bons plans et services citoyens — pour Gafsa.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // jamais 1 : bloquer le zoom casse l'accessibilité
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1fa" },
    { media: "(prefers-color-scheme: dark)", color: "#241f2e" },
  ],
  viewportFit: "cover", // permet l'usage de env(safe-area-inset-*)
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = await getPreferences();
  const t = getDictionary(prefs.locale);
  const { logo: logoMarque, version: versionMarque } = await lireMarque();

  return (
    <html
      lang={prefs.locale}
      dir={prefs.dir}
      data-text-scale={prefs.textScale}
      data-simplified={String(prefs.simplified)}
      className={cairo.variable}
      suppressHydrationWarning
    >
      <head>
        {/*
          Les icônes viennent du logo de l'administration.

          `/brand-icon/*` le lit à la source et le met à la taille demandée
          (voir la route). Elles désignaient auparavant des fichiers figés dans
          `public/icons/` : le logo changé depuis l'administration n'atteignait
          ni l'onglet, ni l'écran d'accueil de l'iPhone.

          Plus de variante SVG : un navigateur qui lit le SVG le préfère au
          PNG, et c'est donc l'ancien dessin qui aurait gagné.

          `?v=` porte la date du logo. iOS range les icônes par adresse et ne
          les relit jamais — supprimer puis réinstaller l'application regrave
          la même image. L'adresse change donc quand le logo change, et
          seulement là.
        */}
        <link rel="icon" href={`/brand-icon/32.png?v=${versionMarque}`} sizes="32x32" type="image/png" />
        <link rel="icon" href={`/brand-icon/192.png?v=${versionMarque}`} sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href={`/brand-icon/180.png?v=${versionMarque}`} sizes="180x180" />
        {/* Voir le commentaire sur `manifest` dans `metadata`, plus haut. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-[12px] focus:bg-[var(--color-brand-fill)] focus:px-4 focus:py-2 focus:text-[0.75rem] focus:font-bold focus:text-white"
        >
          {t.a11y.skipToContent}
        </a>
        {/* ServiceWorkerBridge lit le dictionnaire (bandeau hors ligne,
            invitation à l'installation) : il doit vivre sous le fournisseur. */}
        <I18nProvider initial={prefs} dictionary={t}>
          {children}
          <NavDepthTracker />
        <ServiceWorkerBridge logo={logoMarque} />
        {/*
          La mesure de performance, sur de vrais téléphones.

          Elle n'envoie rien tant que tout va bien : seuls les relevés qui
          dépassent le seuil « à améliorer » de Google partent. Un audit lancé
          depuis un ordinateur de bureau en fibre mesure un site que personne
          n'utilise ; ici on mesure ce que vit quelqu'un en 3G à Gafsa.
        */}
        <WebVitals />
        </I18nProvider>
      </body>
    </html>
  );
}
