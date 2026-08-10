import { redirect } from "next/navigation";
import { getMyShop, getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/dictionaries";
import { AppShell } from "@/components/shell/app-shell";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SpaceSwitcher } from "@/components/shell/space-switcher";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/vendeur");
  if (profile.role !== "vendor" && profile.role !== "admin") redirect("/accueil");

  const shop = await getMyShop();
  const { t } = await getT();

  return (
    <AppShell nav="vendor" role={profile.role}>
      <div className="lg:hidden">
        <SpaceSwitcher role={profile.role} />
      </div>

      {/*
        Bandeau permanent tant que le dossier n'est pas validé. Le vendeur
        peut travailler, mais il doit savoir en continu que sa boutique
        n'est pas encore visible du public.
      */}
      {shop && shop.status !== "approved" && (
        <div
          role="status"
          className="flex-none border-b border-[rgba(122,31,43,0.15)] bg-[var(--color-brand-tint)] px-4 py-[10px]"
        >
          <p className="text-[11px] font-bold text-[var(--color-ink)]">
            {shop.missing_document
              ? format(t.vendor.missingDoc, { doc: shop.missing_document })
              : t.vendor.pendingBanner}
          </p>
          <p className="text-[10px] leading-[1.4] text-[var(--color-muted)]">
            {shop.rejection_reason ?? t.vendor.pendingBody}
          </p>
        </div>
      )}

      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>

      <BottomNav variant="vendor" />
    </AppShell>
  );
}
