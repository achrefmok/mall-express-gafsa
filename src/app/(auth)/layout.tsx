import { AppShell } from "@/components/shell/app-shell";

/**
 * Connexion et inscription : pas de navigation, et une colonne étroite même
 * sur ordinateur. Un formulaire de six champs n'a rien à gagner à s'étaler.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </AppShell>
  );
}
