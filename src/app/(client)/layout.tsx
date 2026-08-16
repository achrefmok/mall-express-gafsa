import { Suspense } from "react";
import { getMyShop, getProfile } from "@/lib/queries";
import { AppShell } from "@/components/shell/app-shell";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SpaceSwitcher } from "@/components/shell/space-switcher";
import { AccessNotice } from "@/components/shell/access-notice";

/**
 * Coque des écrans client. Une seule zone de défilement vertical entre la
 * barre supérieure et la barre d'onglets — les pages posent leur propre
 * en-tête, la barre d'onglets reste collée en bas.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  // Un vendeur qui parcourt l'application côté client doit pouvoir revenir à
  // sa boutique depuis n'importe quel écran. Rien ne s'affiche pour un client.
  const profile = await getProfile();

  // Un compte marqué vendeur n'a pas forcément de boutique : le lien ne
  // s'affiche que s'il mène quelque part.
  const hasShop = profile && profile.role !== "client" ? Boolean(await getMyShop()) : false;

  return (
    <AppShell nav="client" role={profile?.role} hasShop={hasShop}>
      {/* `useSearchParams` exige une frontière Suspense si la page est statique. */}
      <Suspense fallback={null}>
        <AccessNotice />
      </Suspense>

      {/* Sur ordinateur, les espaces sont listés dans la colonne latérale. */}
      {profile && (
        <div className="lg:hidden">
          <SpaceSwitcher role={profile.role} hasShop={hasShop} />
        </div>
      )}

      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>

      <BottomNav variant="client" />
    </AppShell>
  );
}
