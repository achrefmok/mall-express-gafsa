import { AppShell } from "@/components/shell/app-shell";

/** Connexion et inscription de « Taxi & Louage Gafsa » : sans onglets, aux couleurs de l'application. */
export default function TransportAccesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell className="theme-transport" contentWidth="reading">
      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </AppShell>
  );
}
