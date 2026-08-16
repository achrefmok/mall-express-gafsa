import { redirect } from "next/navigation";
import { getMyShop, getProfile } from "@/lib/queries";
import { AppShell } from "@/components/shell/app-shell";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SpaceSwitcher } from "@/components/shell/space-switcher";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/admin");
  if (profile.role !== "admin") redirect("/accueil");

  // Un administrateur ne tient pas nécessairement commerce.
  const hasShop = Boolean(await getMyShop());

  return (
    <AppShell nav="admin" role={profile.role} hasShop={hasShop}>
      <div className="lg:hidden">
        <SpaceSwitcher role={profile.role} hasShop={hasShop} />
      </div>

      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>

      <BottomNav variant="admin" />
    </AppShell>
  );
}
