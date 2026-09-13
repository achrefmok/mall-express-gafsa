import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/queries";
import { TopBar } from "@/components/shell/top-bar";
import { MotionProvider } from "@/components/ui/motion";
import { SimulateurConsole } from "@/components/taxi/simulateur-console";

export const metadata: Metadata = {
  title: "Simulateur taxi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Le simulateur de flotte, réservé au développement.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Trois gardes, et pourquoi il en faut trois
 * ────────────────────────────────────────────────────────────────────────
 *
 * Cet écran crée des comptes et écrit avec la clé de service. Une seule
 * barrière serait imprudente pour un outil de cette portée :
 *
 *   1. `NODE_ENV` ici — la route répond 404 en production, donc elle
 *      n'existe pas : ni dans le plan du site, ni pour qui devine l'adresse.
 *      Un `redirect` aurait avoué l'existence de la page ; `notFound` non.
 *
 *   2. Le rôle ici — un développeur qui teste en local avec un compte client
 *      ne doit pas non plus fabriquer une flotte par curiosité.
 *
 *   3. Le rôle **et** `NODE_ENV` à nouveau dans chaque action serveur. C'est
 *      la seule garde qui compte vraiment : une page masquée ne protège rien,
 *      les Server Actions restant appelables depuis n'importe où. Les deux
 *      premières évitent l'accident ; la troisième arrête l'intention.
 */
export default async function SimulateurPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/taxi/simulateur");
  if (profile.role !== "admin") notFound();

  return (
    <>
      <TopBar title="🧪 Simulateur taxi" back="/taxi" />

      {/*
        Le fournisseur d'animations : la carte et ses repères en dépendent.
        Sans lui, tout s'affiche au bon endroit et rien ne bouge — le défaut
        silencieux que l'espace chauffeur avait déjà connu.
      */}
      <MotionProvider>
        <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
          <SimulateurConsole />
        </div>
      </MotionProvider>
    </>
  );
}
