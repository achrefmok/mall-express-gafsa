import type { Metadata } from "next";
import { getCategories } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { listerCodesActivation } from "@/app/actions/activation";
import { ActivationAdminClient } from "./activation-admin-client";

export const metadata: Metadata = {
  title: "Activation par code",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Créer une boutique pour un commerçant déjà rencontré, sans lui prêter un
 * mot de passe généré à sa place : il choisit le sien à l'activation.
 * L'autorisation se vérifie dans chaque action de `activation.ts`, pas ici —
 * cette page ne fait qu'assembler ce qu'elles renvoient.
 */
export default async function ActivationAdminPage() {
  const [{ t }, categories, codes] = await Promise.all([
    getT(),
    getCategories(),
    listerCodesActivation(),
  ]);

  return (
    <>
      <TopBar title={t.activation.adminTitle} back="/admin/boutiques" />
      <ActivationAdminClient
        categories={categories}
        initialCodes={codes.ok ? codes.data : []}
      />
    </>
  );
}
