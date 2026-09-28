import type { Metadata } from "next";
import { ActivationScreen } from "./activation-screen";

export const metadata: Metadata = {
  title: "Activer ma boutique",
  robots: { index: false, follow: false },
};

/**
 * Atteignable sans connexion, même en préparation — voir la liste des
 * exemptions dans `src/lib/supabase/middleware.ts`. Un commerçant qui vient
 * du monde réel avec un code n'a encore ni session ni compte.
 */
export default function ActivationPage() {
  return <ActivationScreen />;
}
