import { getProfile } from "@/lib/queries";
import { AppShell } from "@/components/shell/app-shell";
import { PageTransition } from "@/components/shell/page-transition";
import { BottomNav } from "@/components/shell/bottom-nav";

/**
 * La coque de « Taxi & Louage Gafsa » : identité ambre (`.theme-transport`,
 * voir globals.css), onglets Accueil · Taxi · Louage · Mes courses · Profil.
 * Aucun lien vers les espaces G-Mall : l'application est autonome.
 */
export default async function TransportAppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <AppShell nav="transport" role={profile?.role} className="theme-transport">
      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav variant="transport" />
    </AppShell>
  );
}
